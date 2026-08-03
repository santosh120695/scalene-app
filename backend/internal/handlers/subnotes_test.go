package handlers

import (
	"strings"
	"testing"

	"knowledgecanvas/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// seedBoard creates a user + board and registers cleanup of everything under it.
func seedBoard(t *testing.T, db *gorm.DB) (userID, boardID uuid.UUID) {
	t.Helper()
	u := models.User{
		ID:           uuid.New(),
		Email:        "subnotes-" + uuid.NewString() + "@test.local",
		PasswordHash: "x",
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	b := models.Board{ID: uuid.New(), UserID: u.ID, Title: "Sub-notes test"}
	if err := db.Create(&b).Error; err != nil {
		t.Fatalf("create board: %v", err)
	}
	t.Cleanup(func() {
		var ids []uuid.UUID
		db.Unscoped().Model(&models.CanvasItem{}).Where("user_id = ?", u.ID).Pluck("id", &ids)
		if len(ids) > 0 {
			db.Unscoped().Where("item_id IN ?", ids).Delete(&models.Comment{})
			db.Unscoped().Where("item_id IN ?", ids).Delete(&models.Todo{})
			db.Where("id IN ?", ids).Delete(&models.NoteItem{})
			// Children reference parents, so clear the FK before deleting rows.
			db.Unscoped().Model(&models.CanvasItem{}).Where("user_id = ?", u.ID).
				Update("parent_item_id", nil)
			db.Unscoped().Where("id IN ?", ids).Delete(&models.CanvasItem{})
		}
		db.Unscoped().Delete(&models.Board{}, "id = ?", b.ID)
		db.Delete(&models.User{}, "id = ?", u.ID)
	})
	return u.ID, b.ID
}

// makeNote inserts a note, optionally nested under parent.
func makeNote(t *testing.T, db *gorm.DB, userID, boardID uuid.UUID, parent *uuid.UUID, title string) uuid.UUID {
	t.Helper()
	ci := models.CanvasItem{
		ID: uuid.New(), BoardID: boardID, UserID: userID,
		ItemType: "note", ParentItemID: parent,
	}
	if err := db.Create(&ci).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	if err := db.Create(&models.NoteItem{ID: ci.ID, Title: title}).Error; err != nil {
		t.Fatalf("create note: %v", err)
	}
	return ci.ID
}

// The grid must show only top-level items — a sub-note is reached through its
// parent, never as a card of its own.
func TestBoardGridExcludesSubNotes(t *testing.T) {
	db := setupCommentsDB(t)
	userID, boardID := seedBoard(t, db)
	parent := makeNote(t, db, userID, boardID, nil, "Parent")
	makeNote(t, db, userID, boardID, &parent, "Child")

	var items []models.CanvasItem
	if err := db.Where("board_id = ? AND parent_item_id IS NULL", boardID).
		Find(&items).Error; err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(items) != 1 || items[0].ID != parent {
		t.Errorf("grid returned %d items, want only the parent", len(items))
	}

	h := &Handler{DB: db}
	if n := h.itemCountsByBoard(userID)[boardID]; n != 1 {
		t.Errorf("board itemCount = %d, want 1 (sub-notes excluded)", n)
	}
	if n := h.subNoteCounts(items)[parent]; n != 1 {
		t.Errorf("subNoteCount = %d, want 1", n)
	}
}

// Deleting a note must take its whole subtree — sub-notes are invisible on the
// grid, so anything left behind is unreachable.
func TestDeleteItemCascadesSubtree(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, boardID := seedBoard(t, db)

	root := makeNote(t, db, userID, boardID, nil, "Root")
	mid := makeNote(t, db, userID, boardID, &root, "Middle")
	leaf := makeNote(t, db, userID, boardID, &mid, "Leaf")
	// A sibling subtree that must survive untouched.
	other := makeNote(t, db, userID, boardID, nil, "Other")
	otherKid := makeNote(t, db, userID, boardID, &other, "Other child")

	if err := db.Create(&models.Comment{
		ItemID: leaf, AnchorID: uuid.New(), IsThreadRoot: true,
		UserID: userID, Content: "on the leaf",
	}).Error; err != nil {
		t.Fatalf("create comment: %v", err)
	}

	ids, err := h.descendantItemIDs(db, userID, root)
	if err != nil {
		t.Fatalf("descendants: %v", err)
	}
	if len(ids) != 3 {
		t.Fatalf("descendantItemIDs returned %d ids, want 3", len(ids))
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("item_id IN ?", ids).Delete(&models.Comment{}).Error; err != nil {
			return err
		}
		return tx.Where("id IN ?", ids).Delete(&models.CanvasItem{}).Error
	})
	if err != nil {
		t.Fatalf("cascade: %v", err)
	}

	for _, id := range []uuid.UUID{root, mid, leaf} {
		var n int64
		db.Model(&models.CanvasItem{}).Where("id = ?", id).Count(&n)
		if n != 0 {
			t.Errorf("item %s still live after deleting its ancestor", id)
		}
	}
	var liveComments int64
	db.Model(&models.Comment{}).Where("item_id = ?", leaf).Count(&liveComments)
	if liveComments != 0 {
		t.Error("leaf's comments should have been soft-deleted with it")
	}
	// The sibling subtree is untouched.
	for _, id := range []uuid.UUID{other, otherKid} {
		var n int64
		db.Model(&models.CanvasItem{}).Where("id = ?", id).Count(&n)
		if n != 1 {
			t.Errorf("sibling %s was wrongly deleted", id)
		}
	}
	// Soft, not hard — note_items survive so the subtree stays recoverable.
	var notes int64
	db.Model(&models.NoteItem{}).Where("id IN ?", ids).Count(&notes)
	if notes != 3 {
		t.Errorf("note_items rows = %d, want 3 (delete is soft)", notes)
	}
}

// A sub-note always lands on its parent's board, whatever boardId was sent —
// the invariant DeleteBoard relies on to never strand a subtree.
func TestSubNoteInheritsParentBoard(t *testing.T) {
	db := setupCommentsDB(t)
	userID, boardA := seedBoard(t, db)

	boardB := models.Board{ID: uuid.New(), UserID: userID, Title: "Other board"}
	if err := db.Create(&boardB).Error; err != nil {
		t.Fatalf("create board B: %v", err)
	}
	t.Cleanup(func() { db.Unscoped().Delete(&models.Board{}, "id = ?", boardB.ID) })

	parent := makeNote(t, db, userID, boardA, nil, "Parent on A")

	// What CreateNote does when parentItemId is set: derive the board from the
	// parent rather than trusting the request.
	h := &Handler{DB: db}
	got, err := h.ownedItem(parent, userID)
	if err != nil {
		t.Fatalf("ownedItem: %v", err)
	}
	if got.BoardID != boardA {
		t.Fatalf("parent board = %s, want %s", got.BoardID, boardA)
	}
	child := makeNote(t, db, userID, got.BoardID, &parent, "Child")

	var ci models.CanvasItem
	db.First(&ci, "id = ?", child)
	if ci.BoardID != boardA {
		t.Errorf("child board = %s, want the parent's board %s", ci.BoardID, boardA)
	}
}

// Children get their own sort space so they can't collide with the 0..N-1 values
// ReorderItems reassigns across the visible grid.
func TestChildSortOrderIsSiblingScoped(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, boardID := seedBoard(t, db)

	parent := makeNote(t, db, userID, boardID, nil, "Parent")
	if got := h.nextChildSortOrder(db, parent); got != 0 {
		t.Errorf("first child sort order = %d, want 0", got)
	}
	first := makeNote(t, db, userID, boardID, &parent, "First")
	db.Model(&models.CanvasItem{}).Where("id = ?", first).Update("sort_order", 0)
	if got := h.nextChildSortOrder(db, parent); got != 1 {
		t.Errorf("second child sort order = %d, want 1", got)
	}
	// The board's own sort space is unaffected by hidden children.
	if got := h.nextSortOrder(db, boardID); got > 1 {
		t.Errorf("board sort order jumped to %d — children leaked into it", got)
	}
}

// syncNoteLinks is what keeps a link's label in step with its target's title,
// and what marks a link whose target is gone.
func TestSyncNoteLinks(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, boardID := seedBoard(t, db)
	target := makeNote(t, db, userID, boardID, nil, "Renamed since")

	html := `<p>see <span data-note-link-id="` + target.String() + `">Stale label</span></p>`
	out, err := h.syncNoteLinks(db, userID, html)
	if err != nil {
		t.Fatalf("sync: %v", err)
	}
	if !strings.Contains(out, "Renamed since") || strings.Contains(out, "Stale label") {
		t.Errorf("label not healed, got: %s", out)
	}

	// A note with no links must not be round-tripped through goquery at all.
	plain := `<p>nothing to do here</p>`
	if same, _ := h.syncNoteLinks(db, userID, plain); same != plain {
		t.Errorf("link-free content was rewritten: %q", same)
	}

	// A dangling target is flagged, not silently dropped.
	gone := `<p><span data-note-link-id="` + uuid.NewString() + `">Ghost</span></p>`
	out, err = h.syncNoteLinks(db, userID, gone)
	if err != nil {
		t.Fatalf("sync missing: %v", err)
	}
	if !strings.Contains(out, `data-note-link-missing="true"`) {
		t.Errorf("dangling link not flagged, got: %s", out)
	}
	if !strings.Contains(out, "Ghost") {
		t.Error("dangling link's text was dropped; it should stay for the user to see")
	}
}

// Renaming a note must update its label everywhere it is linked. syncNoteLinks
// alone only fires when the *linking* note is saved, which for a sub-note is
// never — you rename it from its own page, so the parent's chip would sit stale.
func TestRenameRefreshesLinksToIt(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, boardID := seedBoard(t, db)

	target := makeNote(t, db, userID, boardID, nil, "")
	link := `<p>see <span data-note-link-id="` + target.String() + `">Untitled note</span></p>`
	parent := makeNote(t, db, userID, boardID, nil, "Parent")
	crossRef := makeNote(t, db, userID, boardID, nil, "Cross-ref")
	unrelated := makeNote(t, db, userID, boardID, nil, "Unrelated")
	db.Model(&models.NoteItem{}).Where("id = ?", parent).Update("content", link)
	db.Model(&models.NoteItem{}).Where("id = ?", crossRef).Update("content", link)
	db.Model(&models.NoteItem{}).Where("id = ?", unrelated).Update("content", "<p>no links</p>")

	// What UpdateNote does once it sees the title actually changed.
	db.Model(&models.NoteItem{}).Where("id = ?", target).Update("title", "Real heading")
	if err := h.refreshLinksTo(db, userID, target); err != nil {
		t.Fatalf("refreshLinksTo: %v", err)
	}

	for _, id := range []uuid.UUID{parent, crossRef} {
		var n models.NoteItem
		db.First(&n, "id = ?", id)
		if !strings.Contains(n.Content, ">Real heading</span>") {
			t.Errorf("note %s still shows a stale label: %s", n.Title, n.Content)
		}
	}
	var other models.NoteItem
	db.First(&other, "id = ?", unrelated)
	if other.Content != "<p>no links</p>" {
		t.Errorf("a note with no links was rewritten: %s", other.Content)
	}
}

// The parent chain drives the breadcrumb on a nested note.
func TestParentChainOf(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, boardID := seedBoard(t, db)

	root := makeNote(t, db, userID, boardID, nil, "Root")
	mid := makeNote(t, db, userID, boardID, &root, "Middle")
	leaf := makeNote(t, db, userID, boardID, &mid, "Leaf")

	chain := h.parentChainOf(leaf, userID)
	if len(chain) != 2 {
		t.Fatalf("chain length = %d, want 2", len(chain))
	}
	if chain[0].ID != root || chain[1].ID != mid {
		t.Errorf("chain = %v, want root-most first (%s, %s)", chain, root, mid)
	}
	if got := h.parentChainOf(root, userID); len(got) != 0 {
		t.Errorf("top-level note has a chain of %d, want 0", len(got))
	}
	if kids := h.subNotesOf(root, userID); len(kids) != 1 || kids[0].ID != mid {
		t.Errorf("subNotesOf(root) = %v, want just the middle note", kids)
	}
}
