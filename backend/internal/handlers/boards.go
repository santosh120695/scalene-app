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

func (h *Handler) ListBoards(c *gin.Context) {
	userID := middleware.UserID(c)
	var boards []models.Board
	if err := h.DB.Where("user_id = ?", userID).Order("updated_at DESC").Find(&boards).Error; err != nil {
		serverError(c, err)
		return
	}

	out := make([]gin.H, 0, len(boards))
	for i := range boards {
		// var count int64
		// h.DB.Model(&models.CanvasItem{}).Where("board_id = ?", boards[i].ID).Count(&count)
		out = append(out, h.boardJSON(&boards[i], 0))
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

	var items []models.CanvasItem
	if err := h.DB.Where("board_id = ?", boardID).
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
	h.DB.Model(&models.CanvasItem{}).Where("board_id = ?", board.ID).Count(&count)
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
	h.DB.Model(&models.CanvasItem{}).Where("board_id = ?", board.ID).Count(&count)
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
			if err = tx.Where("item_id IN ?", itemIDs).Delete(&models.SubNote{}).Error; err != nil {
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
