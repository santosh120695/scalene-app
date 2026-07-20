package handlers

import (
	"net/http"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GET /api/v1/items/:id
func (h *Handler) GetItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	ci, err := h.ownedItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}
	out := h.itemMap(c.Request.Context(), *ci)
	out["success"] = true
	c.JSON(http.StatusOK, out)
}

type reorderReq struct {
	ItemIDs []uuid.UUID `json:"itemIds" binding:"required"`
}

// PATCH /api/v1/boards/:boardId/reorder — reassign sort_order from index order.
func (h *Handler) ReorderItems(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid board id")
		return
	}
	if _, err := h.ownedBoard(boardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}
	var req reorderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "itemIds is required")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		for idx, id := range req.ItemIDs {
			if err := tx.Model(&models.CanvasItem{}).
				Where("id = ? AND board_id = ? AND user_id = ?", id, boardID, userID).
				Update("sort_order", idx).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

type pinReq struct {
	IsPinned bool `json:"isPinned"`
}

// PATCH /api/v1/items/:id/pin
func (h *Handler) PinItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	ci, err := h.ownedItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}
	var req pinReq
	_ = c.ShouldBindJSON(&req)
	if err := h.DB.Model(&models.CanvasItem{}).Where("id = ?", ci.ID).
		Update("is_pinned", req.IsPinned).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "isPinned": req.IsPinned})
}

type colorReq struct {
	ColorLabel string `json:"colorLabel"`
}

// PATCH /api/v1/items/:id/color
func (h *Handler) ColorItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	ci, err := h.ownedItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}
	var req colorReq
	_ = c.ShouldBindJSON(&req)
	if err := h.DB.Model(&models.CanvasItem{}).Where("id = ?", ci.ID).
		Update("color_label", req.ColorLabel).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "colorLabel": req.ColorLabel})
}

type moveReq struct {
	BoardID uuid.UUID `json:"boardId" binding:"required"`
}

// PATCH /api/v1/items/:id/board — move an item to a different board owned by the user.
func (h *Handler) MoveItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	ci, err := h.ownedItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}
	var req moveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "boardId is required")
		return
	}
	if _, err := h.ownedBoard(req.BoardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}
	if req.BoardID == ci.BoardID {
		c.JSON(http.StatusOK, gin.H{"success": true, "boardId": ci.BoardID})
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		var min *int
		if err := tx.Model(&models.CanvasItem{}).
			Where("board_id = ?", req.BoardID).
			Select("MIN(sort_order)").Scan(&min).Error; err != nil {
			return err
		}
		sortOrder := 0
		if min != nil {
			sortOrder = *min - 1
		}
		return tx.Model(&models.CanvasItem{}).Where("id = ?", ci.ID).
			Updates(map[string]any{"board_id": req.BoardID, "sort_order": sortOrder}).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "boardId": req.BoardID})
}

// DELETE /api/v1/items/:id — soft-deletes the item and its sub-notes/todos.
// Stored files are kept so the item remains recoverable.
func (h *Handler) DeleteItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	ci, err := h.ownedItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("item_id = ?", ci.ID).Delete(&models.SubNote{}).Error; err != nil {
			return err
		}
		if err := tx.Where("item_id = ?", ci.ID).Delete(&models.Todo{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.CanvasItem{}, "id = ?", ci.ID).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
