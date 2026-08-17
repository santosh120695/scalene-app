package handlers

import (
	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (h *Handler) boardJSON(b *models.Board, itemCount int64) gin.H {
	return gin.H{
		"id":          b.ID,
		"userId":      b.UserID,
		"parentId":    b.ParentID,
		"title":       b.Title,
		"description": b.Description,
		"coverUrl":    b.CoverURL,
		"isPublic":    b.IsPublic,
		"boardState":  b.BoardState,
		"tags":        b.Tags,
		"itemCount":   itemCount,
		"createdAt":   b.CreatedAt,
		"updatedAt":   b.UpdatedAt,
	}
}

// subNoteCounts returns how many live sub-notes hang off each of the given
// notes, in one grouped query. Non-note items are skipped — only notes nest.
func (h *Handler) subNoteCounts(items []models.CanvasItem) map[uuid.UUID]int {
	ids := make([]uuid.UUID, 0, len(items))
	for _, ci := range items {
		if ci.ItemType == "note" {
			ids = append(ids, ci.ID)
		}
	}
	out := map[uuid.UUID]int{}
	if len(ids) == 0 {
		return out
	}
	var rows []struct {
		ParentItemID uuid.UUID
		N            int
	}
	h.DB.Model(&models.CanvasItem{}).
		Select("parent_item_id, COUNT(*) AS n").
		Where("parent_item_id IN ?", ids).
		Group("parent_item_id").Scan(&rows)
	for _, r := range rows {
		out[r.ParentItemID] = r.N
	}
	return out
}

// itemCountsByBoard returns live top-level item counts for every board the user
// owns, in one grouped query. Counts what the grid actually shows, so sub-notes
// are excluded. GORM adds `deleted_at IS NULL` for us.
func (h *Handler) itemCountsByBoard(userID uuid.UUID) map[uuid.UUID]int64 {
	var rows []struct {
		BoardID uuid.UUID
		N       int64
	}
	h.DB.Model(&models.CanvasItem{}).
		Select("board_id, COUNT(*) AS n").
		Where("user_id = ? AND parent_item_id IS NULL", userID).
		Group("board_id").Scan(&rows)

	out := make(map[uuid.UUID]int64, len(rows))
	for _, r := range rows {
		out[r.BoardID] = r.N
	}
	return out
}

func (h *Handler) ListBoards(c *gin.Context) {
	userID := middleware.UserID(c)
	var boards []models.Board
	if err := h.DB.Where("user_id = ?", userID).Order("updated_at DESC").Find(&boards).Error; err != nil {
		serverError(c, err)
		return
	}

	// One grouped query rather than a count per board — the per-board version was
	// an N+1 over every board the user owns. Callers rely on this being real:
	// ItemTreePicker only offers to expand a board when itemCount > 0.
	counts := h.itemCountsByBoard(userID)

	out := make([]gin.H, 0, len(boards))
	for i := range boards {
		out = append(out, h.boardJSON(&boards[i], counts[boards[i].ID]))
	}
	c.JSON(http.StatusOK, gin.H{"boards": out})
}

type createBoardReq struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Tags        []string   `json:"tags"`
	ParentID    *uuid.UUID `json:"parentId"`
}

func (h *Handler) CreateBoard(c *gin.Context) {
	userID := middleware.UserID(c)
	var req createBoardReq
	_ = c.ShouldBindJSON(&req)

	if req.ParentID != nil {
		if _, err := h.ownedBoard(*req.ParentID, userID); err != nil {
			badRequest(c, "Parent board not found")
			return
		}
	}

	title := req.Title
	if title == "" {
		title = "Untitled Board"
	}
	board := models.Board{
		UserID:      userID,
		ParentID:    req.ParentID,
		Title:       title,
		Description: req.Description,
		Tags:        models.StringArray(req.Tags),
		BoardState:  models.JSONB{"sortBy": "recent"},
	}
	if err := h.DB.Create(&board).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.boardJSON(&board, 0))
}

func (h *Handler) GetBoard(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}

	board, err := h.ownedBoard(boardID, userID)
	if err != nil {
		notFound(c, "Board not found")
		return
	}

	// Top-level only: sub-notes are reached through their parent note, not the
	// grid. Without this filter every jotted fragment becomes a card.
	var items []models.CanvasItem
	if err := h.DB.Where("board_id = ? AND parent_item_id IS NULL", boardID).
		Order("is_pinned DESC, sort_order ASC").
		Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}

	ctx := c.Request.Context()
	itemDTOs := make([]gin.H, 0, len(items))
	for _, ci := range items {
		itemDTOs = append(itemDTOs, h.itemMap(ctx, ci))
	}

	// One grouped query for the whole page rather than a count per card, which
	// would double GetBoard's already-N+1 query load.
	for id, n := range h.subNoteCounts(items) {
		for i := range items {
			if items[i].ID == id {
				itemDTOs[i]["subNoteCount"] = n
			}
		}
	}

	resp := h.boardJSON(board, int64(len(items)))
	resp["items"] = itemDTOs
	c.JSON(http.StatusOK, resp)
}

type updateBoardReq struct {
	Title       *string   `json:"title"`
	Description *string   `json:"description"`
	CoverURL    *string   `json:"coverUrl"`
	IsPublic    *bool     `json:"isPublic"`
	Tags        *[]string `json:"tags"`
}

func (h *Handler) UpdateBoard(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}
	board, err := h.ownedBoard(boardID, userID)
	if err != nil {
		notFound(c, "Board not found")
		return
	}

	var req updateBoardReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}
	if req.Title != nil {
		board.Title = *req.Title
	}
	if req.Description != nil {
		board.Description = *req.Description
	}
	if req.CoverURL != nil {
		board.CoverURL = *req.CoverURL
	}
	if req.IsPublic != nil {
		board.IsPublic = *req.IsPublic
	}
	if req.Tags != nil {
		board.Tags = models.StringArray(*req.Tags)
	}
	if err := h.DB.Save(board).Error; err != nil {
		serverError(c, err)
		return
	}
	var count int64
	h.DB.Model(&models.CanvasItem{}).Where("board_id = ? AND parent_item_id IS NULL", board.ID).Count(&count)
	c.JSON(http.StatusOK, h.boardJSON(board, count))
}

type moveBoardReq struct {
	ParentID *uuid.UUID `json:"parentId"`
}

func (h *Handler) descendantBoardIDs(userID, rootID uuid.UUID) []uuid.UUID {
	var boards []models.Board
	h.DB.Select("id", "parent_id").Where("user_id = ?", userID).Find(&boards)
	ids := map[uuid.UUID]bool{rootID: true}
	for changed := true; changed; {
		changed = false
		for _, b := range boards {
			if b.ParentID != nil && ids[*b.ParentID] && !ids[b.ID] {
				ids[b.ID] = true
				changed = true
			}
		}
	}
	out := make([]uuid.UUID, 0, len(ids))
	for id := range ids {
		out = append(out, id)
	}
	return out
}

func (h *Handler) selfOrDescendant(userID, rootID, candidateID uuid.UUID) bool {
	for _, id := range h.descendantBoardIDs(userID, rootID) {
		if id == candidateID {
			return true
		}
	}
	return false
}

func (h *Handler) MoveBoard(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}
	board, err := h.ownedBoard(boardID, userID)
	if err != nil {
		notFound(c, "Board not found")
		return
	}
	var req moveBoardReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}

	if req.ParentID != nil {
		if _, err := h.ownedBoard(*req.ParentID, userID); err != nil {
			notFound(c, "Parent board not found")
			return
		}
		if h.selfOrDescendant(userID, boardID, *req.ParentID) {
			badRequest(c, "Cannot move a board into itself or one of its own sub-boards")
			return
		}
	}

	board.ParentID = req.ParentID
	if err := h.DB.Model(&models.Board{}).Where("id = ?", board.ID).
		Update("parent_id", req.ParentID).Error; err != nil {
		serverError(c, err)
		return
	}
	var count int64
	h.DB.Model(&models.CanvasItem{}).Where("board_id = ? AND parent_item_id IS NULL", board.ID).Count(&count)
	c.JSON(http.StatusOK, h.boardJSON(board, count))
}

func (h *Handler) UpdateBoardState(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}
	board, err := h.ownedBoard(boardID, userID)
	if err != nil {
		notFound(c, "Board not found")
		return
	}
	var state models.JSONB
	if err := c.ShouldBindJSON(&state); err != nil {
		badRequest(c, "Invalid board state")
		return
	}
	board.BoardState = state
	if err := h.DB.Model(board).Update("board_state", state).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) DeleteBoard(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}
	if _, err = h.ownedBoard(boardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}

	boardIDs := h.descendantBoardIDs(userID, boardID)
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		var itemIDs []uuid.UUID
		if err = tx.Model(&models.CanvasItem{}).Where("board_id IN ?", boardIDs).
			Pluck("id", &itemIDs).Error; err != nil {
			return err
		}
		if len(itemIDs) > 0 {
			if err = tx.Where("item_id IN ?", itemIDs).Delete(&models.Comment{}).Error; err != nil {
				return err
			}
		}
		if err = tx.Where("board_id IN ?", boardIDs).Delete(&models.Todo{}).Error; err != nil {
			return err
		}
		if err = tx.Where("board_id IN ?", boardIDs).Delete(&models.CanvasItem{}).Error; err != nil {
			return err
		}
		return tx.Where("id IN ?", boardIDs).Delete(&models.Board{}).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
