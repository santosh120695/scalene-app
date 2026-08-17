package handlers

import (
	"net/http"
	"strings"

	"knowledgecanvas/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// searchRow is one flattened search hit across the split item tables.
type searchRow struct {
	ItemID     uuid.UUID `json:"itemId"`
	BoardID    uuid.UUID `json:"boardId"`
	BoardTitle string    `json:"boardTitle"`
	CardType   string    `json:"cardType"`
	Title      string    `json:"title"`
	Snippet    string    `json:"snippet"`
	// Set when the hit is a sub-note. Sub-notes are hidden from the board grid,
	// so search is a primary way to reach them — without the parent's name a
	// result gives no clue where it lives.
	ParentItemID *uuid.UUID `json:"parentItemId"`
	ParentTitle  string     `json:"parentTitle"`
}

// GET /api/v1/search?q={query}&boardId={optional}
// UNIONs full-text matches across note/link/pdf/image tables (PRD §4.4).
func (h *Handler) Search(c *gin.Context) {
	userID := middleware.UserID(c)
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"results": []searchRow{}, "total": 0})
		return
	}
	boardFilter := c.Query("boardId")

	// Optional board scoping appended to each branch's WHERE.
	boardClause := ""
	if boardFilter != "" {
		boardClause = " AND ci.board_id = ?"
	}

	sql := `
SELECT ci.id AS item_id, ci.board_id, b.title AS board_title, ci.item_type AS card_type,
       COALESCE(n.title,'') AS title,
       LEFT(regexp_replace(COALESCE(n.content,''), '<[^>]+>', '', 'g'), 200) AS snippet,
       ci.parent_item_id AS parent_item_id,
       COALESCE(pn.title,'') AS parent_title
FROM canvas_items ci
JOIN boards b ON b.id = ci.board_id
JOIN note_items n ON n.id = ci.id
LEFT JOIN canvas_items pci ON pci.id = ci.parent_item_id AND pci.deleted_at IS NULL
LEFT JOIN note_items pn ON pn.id = pci.id
WHERE ci.user_id = ? AND ci.deleted_at IS NULL` + boardClause + `
  AND to_tsvector('english', COALESCE(n.title,'') || ' ' || COALESCE(n.content,'')) @@ plainto_tsquery('english', ?)

UNION ALL

SELECT ci.id, ci.board_id, b.title, ci.item_type,
       COALESCE(l.title,''), LEFT(COALESCE(l.description,''), 200), NULL::uuid, ''
FROM canvas_items ci
JOIN boards b ON b.id = ci.board_id
JOIN link_items l ON l.id = ci.id
WHERE ci.user_id = ? AND ci.deleted_at IS NULL` + boardClause + `
  AND to_tsvector('english', COALESCE(l.title,'') || ' ' || COALESCE(l.description,'')) @@ plainto_tsquery('english', ?)

UNION ALL

SELECT ci.id, ci.board_id, b.title, ci.item_type,
       COALESCE(p.title,''), LEFT(COALESCE(p.title,''), 200), NULL::uuid, ''
FROM canvas_items ci
JOIN boards b ON b.id = ci.board_id
JOIN pdf_items p ON p.id = ci.id
WHERE ci.user_id = ? AND ci.deleted_at IS NULL` + boardClause + `
  AND to_tsvector('english', COALESCE(p.title,'')) @@ plainto_tsquery('english', ?)

UNION ALL

SELECT ci.id, ci.board_id, b.title, ci.item_type,
       COALESCE(im.caption,''), LEFT(COALESCE(im.caption,''), 200), NULL::uuid, ''
FROM canvas_items ci
JOIN boards b ON b.id = ci.board_id
JOIN image_items im ON im.id = ci.id
WHERE ci.user_id = ? AND ci.deleted_at IS NULL` + boardClause + `
  AND to_tsvector('english', COALESCE(im.caption,'')) @@ plainto_tsquery('english', ?)

LIMIT 50`

	// Args in branch order: (userID [, boardFilter], query) repeated per UNION branch.
	args := make([]interface{}, 0, 12)
	appendBranch := func() {
		args = append(args, userID)
		if boardFilter != "" {
			args = append(args, boardFilter)
		}
		args = append(args, query)
	}
	for i := 0; i < 4; i++ {
		appendBranch()
	}

	var rows []searchRow
	if err := h.DB.Raw(sql, args...).Scan(&rows).Error; err != nil {
		serverError(c, err)
		return
	}
	if rows == nil {
		rows = []searchRow{}
	}
	c.JSON(http.StatusOK, gin.H{"results": rows, "total": len(rows)})
}
