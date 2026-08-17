package handlers

import (
	"strings"

	"knowledgecanvas/internal/models"

	"github.com/PuerkitoBio/goquery"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// A note can link to another note. The editor writes the link into the note's
// HTML as <span data-note-link-id="…">Label</span>; the label is plain text
// inside the span, so it renders correctly even on read-only surfaces that
// never mount the editor's node view.
//
// The label is a snapshot, and a note's title changes whenever its first block
// is edited. Rather than have the client chase that (which would dirty the
// document and pile up undo steps), the label is healed here on every save —
// the same shape as parseTaskItems injecting data-todo-id, and for the same
// reason: the note HTML is the source of truth and the server owns rewriting it.
const noteLinkSelector = `span[data-note-link-id]`

// syncNoteLinks rewrites every note-link span in content to its target's
// current title, and stamps data-note-link-missing on links whose target is
// gone (deleted, or never owned by this user). Returns the rewritten HTML.
func (h *Handler) syncNoteLinks(tx *gorm.DB, userID uuid.UUID, content string) (string, error) {
	// Early-out so notes without links never round-trip through goquery, which
	// normalizes whitespace and attribute order on the whole document.
	if !strings.Contains(content, "data-note-link-id") {
		return content, nil
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return content, err
	}

	// Collect the distinct targets first so titles resolve in one query rather
	// than one per link.
	ids := make([]uuid.UUID, 0, 4)
	seen := map[uuid.UUID]bool{}
	doc.Find(noteLinkSelector).Each(func(_ int, s *goquery.Selection) {
		raw, _ := s.Attr("data-note-link-id")
		id, err := uuid.Parse(raw)
		if err != nil || seen[id] {
			return
		}
		seen[id] = true
		ids = append(ids, id)
	})
	if len(ids) == 0 {
		return content, nil
	}

	type row struct {
		ID    uuid.UUID
		Title string
	}
	var rows []row
	// Joined through canvas_items so a soft-deleted note counts as missing, and
	// scoped to the user so one person's note ids can never leak another's title.
	if err := tx.Raw(`
SELECT ci.id, COALESCE(n.title, '') AS title
  FROM canvas_items ci
  JOIN note_items n ON n.id = ci.id
 WHERE ci.id IN ? AND ci.user_id = ? AND ci.deleted_at IS NULL`,
		ids, userID).Scan(&rows).Error; err != nil {
		return content, err
	}
	titles := make(map[uuid.UUID]string, len(rows))
	for _, r := range rows {
		titles[r.ID] = r.Title
	}

	doc.Find(noteLinkSelector).Each(func(_ int, s *goquery.Selection) {
		raw, _ := s.Attr("data-note-link-id")
		id, err := uuid.Parse(raw)
		if err != nil {
			return
		}
		title, ok := titles[id]
		if !ok {
			// Target is gone. The link stays in the document — the client renders
			// it struck through with a "Remove link" action, rather than silently
			// dropping text the user wrote around it.
			s.SetAttr("data-note-link-missing", "true")
			return
		}
		s.RemoveAttr("data-note-link-missing")
		if title = strings.TrimSpace(title); title == "" {
			// A note's title is derived from its first block, so a freshly
			// created sub-note has none until it's written into.
			title = "Untitled note"
		}
		s.SetText(title)
	})

	rewritten, err := doc.Find("body").Html()
	if err != nil {
		return content, err
	}
	return rewritten, nil
}

// refreshLinksTo rewrites the chip label in every note that links to targetID.
//
// The label is a snapshot living in the *linking* note's HTML, and syncNoteLinks
// only runs when that note is saved. So renaming a note would leave every link
// to it stale until each linking note happened to be edited for some other
// reason — which for a sub-note is "never", since you rename it from its own
// page. Pushing the update from the renamed note is what keeps them in step.
func (h *Handler) refreshLinksTo(tx *gorm.DB, userID, targetID uuid.UUID) error {
	type row struct {
		ID      uuid.UUID
		Content string
	}
	var rows []row
	// Matches the exact attribute the editor writes, so a note whose prose
	// merely mentions the uuid is not rewritten.
	needle := `%data-note-link-id="` + targetID.String() + `"%`
	if err := tx.Raw(`
SELECT n.id, n.content
  FROM note_items n
  JOIN canvas_items ci ON ci.id = n.id
 WHERE ci.user_id = ? AND ci.deleted_at IS NULL AND n.content LIKE ?`,
		userID, needle).Scan(&rows).Error; err != nil {
		return err
	}
	for _, r := range rows {
		updated, err := h.syncNoteLinks(tx, userID, r.Content)
		if err != nil {
			return err
		}
		if updated == r.Content {
			continue
		}
		if err := tx.Model(&models.NoteItem{}).Where("id = ?", r.ID).
			Update("content", updated).Error; err != nil {
			return err
		}
	}
	return nil
}

// subNoteRow is the compact shape GetItem returns for a note's children — enough
// to list and open them without loading every child's full content.
type subNoteRow struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	ItemType  string    `json:"itemType"`
	UpdatedAt string    `json:"updatedAt"`
}

// subNotesOf lists a note's live children in sort order.
func (h *Handler) subNotesOf(parentID, userID uuid.UUID) []subNoteRow {
	rows := make([]subNoteRow, 0)
	h.DB.Raw(`
SELECT ci.id, COALESCE(n.title, '') AS title, ci.item_type, ci.updated_at
  FROM canvas_items ci
  LEFT JOIN note_items n ON n.id = ci.id
 WHERE ci.parent_item_id = ? AND ci.user_id = ? AND ci.deleted_at IS NULL
 ORDER BY ci.sort_order ASC`, parentID, userID).Scan(&rows)
	return rows
}

// parentCrumb is one step of the chain from a sub-note back up to its root note.
type parentCrumb struct {
	ID    uuid.UUID `json:"id"`
	Title string    `json:"title"`
}

// parentChainOf walks up from an item to its root note, root-most first, so the
// detail view can render "Board ▸ Root note ▸ … ▸ this note". Depth-capped
// because a corrupted parent chain would otherwise spin forever.
func (h *Handler) parentChainOf(itemID, userID uuid.UUID) []parentCrumb {
	chain := make([]parentCrumb, 0)
	h.DB.Raw(`
WITH RECURSIVE up AS (
  SELECT id, parent_item_id, 0 AS depth
    FROM canvas_items
   WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  UNION ALL
  SELECT p.id, p.parent_item_id, u.depth + 1
    FROM canvas_items p
    JOIN up u ON p.id = u.parent_item_id
   WHERE p.user_id = ? AND p.deleted_at IS NULL AND u.depth < 32
)
SELECT u.id, COALESCE(n.title, '') AS title
  FROM up u
  LEFT JOIN note_items n ON n.id = u.id
 WHERE u.depth > 0
 ORDER BY u.depth DESC`, itemID, userID, userID).Scan(&chain)
	return chain
}

// descendantItemIDs returns rootID plus every live item nested beneath it.
//
// Deliberately not modelled on descendantBoardIDs (boards.go): that loads every
// board the user owns and iterates to a fixed point in Go, which is fine for
// tens of boards but would pull the user's whole item table into memory on every
// delete. UNION (not UNION ALL) dedupes against the accumulated result, so a
// cycle terminates rather than looping — the same protection the !ids[b.ID]
// guard gives descendantBoardIDs.
func (h *Handler) descendantItemIDs(tx *gorm.DB, userID, rootID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := tx.Raw(`
WITH RECURSIVE subtree AS (
  SELECT id FROM canvas_items
   WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  UNION
  SELECT ci.id FROM canvas_items ci
    JOIN subtree s ON ci.parent_item_id = s.id
   WHERE ci.user_id = ? AND ci.deleted_at IS NULL
)
SELECT id FROM subtree`, rootID, userID, userID).Scan(&ids).Error
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		// The root itself is always in scope even if the recursive scan came back
		// empty (e.g. it was concurrently soft-deleted) — callers delete by id.
		ids = []uuid.UUID{rootID}
	}
	return ids, nil
}

// nextChildSortOrder is nextSortOrder's sibling-scoped twin.
//
// Children must NOT share the board's sort space: they're hidden from the grid,
// so they'd silently inflate MAX(sort_order) and collide with the 0..N-1 values
// ReorderItems reassigns across the visible cards.
func (h *Handler) nextChildSortOrder(tx *gorm.DB, parentID uuid.UUID) int {
	var max *int
	tx.Model(&models.CanvasItem{}).
		Where("parent_item_id = ?", parentID).
		Select("MAX(sort_order)").Scan(&max)
	if max == nil {
		return 0
	}
	return *max + 1
}
