package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/PuerkitoBio/goquery"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const taskItemSelector = `li[data-type="taskItem"]`

// ---- HTML <-> checklist parsing ----------------------------------------------
//
// Note content is TipTap-generated HTML; checklist items render as
// <li data-type="taskItem" data-checked="true|false">. The HTML is always the
// source of truth — the todos table is a synced, queryable index of it.

type parsedTodo struct {
	ID        string
	Text      string
	Completed bool
	Position  int
}

// parseTaskItems extracts checklist items from note HTML, assigning a stable
// data-todo-id to any item that doesn't already have one. Returns the parsed
// items and the (possibly id-injected) HTML.
func parseTaskItems(content string) ([]parsedTodo, string, error) {
	if !strings.Contains(content, "taskItem") {
		return nil, content, nil
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return nil, content, err
	}

	var items []parsedTodo
	seen := make(map[string]bool)
	doc.Find(taskItemSelector).Each(func(i int, li *goquery.Selection) {
		id, ok := li.Attr("data-todo-id")
		// A blank id, or one already used earlier in this same note (e.g. from
		// the pre-fix editor bug that copied an id onto a newly split item),
		// gets a fresh one so two checklist items never collapse into one row.
		if !ok || id == "" || seen[id] {
			id = uuid.New().String()
			li.SetAttr("data-todo-id", id)
		}
		seen[id] = true
		completed := li.AttrOr("data-checked", "false") == "true"
		text := strings.TrimSpace(li.Find("div").First().Text())
		if text == "" {
			text = strings.TrimSpace(li.Text())
		}
		items = append(items, parsedTodo{ID: id, Text: text, Completed: completed, Position: i})
	})

	rewritten, err := doc.Find("body").Html()
	if err != nil {
		return items, content, err
	}
	return items, rewritten, nil
}

// setTaskItemChecked flips the data-checked (and nested checkbox) state for
// the task item with the given id inside a note's HTML content. Returns the
// rewritten HTML and whether a matching item was found and changed.
func setTaskItemChecked(content, todoID string, checked bool) (string, bool, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return content, false, err
	}
	sel := doc.Find(taskItemSelector).FilterFunction(func(_ int, li *goquery.Selection) bool {
		id, _ := li.Attr("data-todo-id")
		return id == todoID
	})
	if sel.Length() == 0 {
		return content, false, nil
	}
	sel.SetAttr("data-checked", strconv.FormatBool(checked))
	input := sel.Find(`input[type="checkbox"]`).First()
	if input.Length() > 0 {
		if checked {
			input.SetAttr("checked", "checked")
		} else {
			input.RemoveAttr("checked")
		}
	}
	rewritten, err := doc.Find("body").Html()
	if err != nil {
		return content, false, err
	}
	return rewritten, true, nil
}

// removeTaskItem deletes the task item with the given id from a note's HTML
// content. Returns the rewritten HTML and whether a matching item was found.
func removeTaskItem(content, todoID string) (string, bool, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return content, false, err
	}
	sel := doc.Find(taskItemSelector).FilterFunction(func(_ int, li *goquery.Selection) bool {
		id, _ := li.Attr("data-todo-id")
		return id == todoID
	})
	if sel.Length() == 0 {
		return content, false, nil
	}
	sel.Remove()
	rewritten, err := doc.Find("body").Html()
	if err != nil {
		return content, false, err
	}
	return rewritten, true, nil
}

// syncTodosFromContent upserts todos rows to match the checklist items found
// in content and deletes any todos rows for items no longer present. Returns
// the (possibly id-injected) HTML that should be persisted back to the note.
func (h *Handler) syncTodosFromContent(tx *gorm.DB, itemID, boardID, userID uuid.UUID, content string) (string, error) {
	items, rewritten, err := parseTaskItems(content)
	if err != nil {
		return content, err
	}

	keepIDs := make([]uuid.UUID, 0, len(items))
	now := time.Now()
	for _, it := range items {
		id, err := uuid.Parse(it.ID)
		if err != nil {
			continue
		}
		keepIDs = append(keepIDs, id)
		todo := models.Todo{
			ID:          id,
			ItemID:      uuid.NullUUID{UUID: itemID, Valid: true},
			BoardID:     uuid.NullUUID{UUID: boardID, Valid: true},
			UserID:      userID,
			Text:        it.Text,
			IsCompleted: it.Completed,
			Position:    it.Position,
			UpdatedAt:   now,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"text", "is_completed", "position", "updated_at"}),
		}).Create(&todo).Error; err != nil {
			return content, err
		}
	}

	del := tx.Where("item_id = ?", itemID)
	if len(keepIDs) > 0 {
		del = del.Where("id NOT IN ?", keepIDs)
	}
	if err := del.Delete(&models.Todo{}).Error; err != nil {
		return content, err
	}

	return rewritten, nil
}

// ---- HTTP handlers ------------------------------------------------------------

type todoRow struct {
	ID          uuid.UUID     `json:"id"`
	ItemID      uuid.NullUUID `json:"itemId"`
	BoardID     uuid.NullUUID `json:"boardId"`
	BoardTitle  string        `json:"boardTitle"`
	NoteTitle   string        `json:"noteTitle"`
	Text        string        `json:"text"`
	IsCompleted bool          `json:"isCompleted"`
	Position    int           `json:"position"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// GET /api/v1/todos?completed=true|false&boardId=optional
func (h *Handler) ListTodos(c *gin.Context) {
	userID := middleware.UserID(c)

	// LEFT JOINs because standalone quick todos have no item_id/board_id.
	sql := `
SELECT t.id, t.item_id, t.board_id, COALESCE(b.title,'') AS board_title, COALESCE(n.title,'') AS note_title,
       t.text, t.is_completed, t.position, t.created_at, t.updated_at
FROM todos t
LEFT JOIN boards b ON b.id = t.board_id
LEFT JOIN note_items n ON n.id = t.item_id
WHERE t.user_id = ?`
	args := []interface{}{userID}

	if completed := c.Query("completed"); completed != "" {
		if val, err := strconv.ParseBool(completed); err == nil {
			sql += " AND t.is_completed = ?"
			args = append(args, val)
		}
	}
	if boardID := c.Query("boardId"); boardID != "" {
		sql += " AND t.board_id = ?"
		args = append(args, boardID)
	}
	sql += " ORDER BY t.is_completed ASC, t.created_at DESC"

	var rows []todoRow
	if err := h.DB.Raw(sql, args...).Scan(&rows).Error; err != nil {
		serverError(c, err)
		return
	}
	if rows == nil {
		rows = []todoRow{}
	}
	c.JSON(http.StatusOK, gin.H{"todos": rows, "total": len(rows)})
}

type createQuickTodoReq struct {
	Text string `json:"text" binding:"required"`
}

// POST /api/v1/todos — quick-add a standalone todo from the central Todos
// view. Unlike checklist-derived todos, these have no backing note/board:
// item_id and board_id are left null on the row.
func (h *Handler) CreateQuickTodo(c *gin.Context) {
	userID := middleware.UserID(c)
	var req createQuickTodoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "text is required")
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		badRequest(c, "text is required")
		return
	}

	todo := models.Todo{
		ID:     uuid.New(),
		UserID: userID,
		Text:   text,
	}
	if err := h.DB.Create(&todo).Error; err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusCreated, todoRow{
		ID:          todo.ID,
		Text:        todo.Text,
		IsCompleted: todo.IsCompleted,
		Position:    todo.Position,
		CreatedAt:   todo.CreatedAt,
		UpdatedAt:   todo.UpdatedAt,
	})
}

type toggleTodoReq struct {
	IsCompleted bool `json:"isCompleted"`
}

// PATCH /api/v1/todos/:id
func (h *Handler) ToggleTodo(c *gin.Context) {
	userID := middleware.UserID(c)
	todoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid todo id")
		return
	}
	var req toggleTodoReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "isCompleted is required")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		var todo models.Todo
		if err := tx.First(&todo, "id = ? AND user_id = ?", todoID, userID).Error; err != nil {
			return err
		}
		if err := tx.Model(&todo).Update("is_completed", req.IsCompleted).Error; err != nil {
			return err
		}
		if !todo.ItemID.Valid {
			// Standalone quick todo — no note content to keep in sync.
			return nil
		}

		var note models.NoteItem
		if err := tx.First(&note, "id = ?", todo.ItemID.UUID).Error; err != nil {
			return err
		}
		patched, changed, err := setTaskItemChecked(note.Content, todo.ID.String(), req.IsCompleted)
		if err != nil {
			return err
		}
		if changed {
			if err := tx.Model(&models.NoteItem{}).Where("id = ?", todo.ItemID.UUID).
				Update("content", patched).Error; err != nil {
				return err
			}
			tx.Model(&models.CanvasItem{}).Where("id = ?", todo.ItemID.UUID).Update("updated_at", gorm.Expr("NOW()"))
		}
		return nil
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			notFound(c, "Todo not found")
			return
		}
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "isCompleted": req.IsCompleted})
}

// DELETE /api/v1/todos/:id — deletes a todo. For a checklist-derived todo,
// also removes the backing <li> from the note's content so it doesn't get
// re-created on the next syncTodosFromContent.
func (h *Handler) DeleteTodo(c *gin.Context) {
	userID := middleware.UserID(c)
	todoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid todo id")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		var todo models.Todo
		if err := tx.First(&todo, "id = ? AND user_id = ?", todoID, userID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&todo).Error; err != nil {
			return err
		}
		if !todo.ItemID.Valid {
			// Standalone quick todo — no note content to keep in sync.
			return nil
		}

		var note models.NoteItem
		if err := tx.First(&note, "id = ?", todo.ItemID.UUID).Error; err != nil {
			return err
		}
		patched, changed, err := removeTaskItem(note.Content, todo.ID.String())
		if err != nil {
			return err
		}
		if changed {
			if err := tx.Model(&models.NoteItem{}).Where("id = ?", todo.ItemID.UUID).
				Update("content", patched).Error; err != nil {
				return err
			}
			tx.Model(&models.CanvasItem{}).Where("id = ?", todo.ItemID.UUID).Update("updated_at", gorm.Expr("NOW()"))
		}
		return nil
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			notFound(c, "Todo not found")
			return
		}
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
