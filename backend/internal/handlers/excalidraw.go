package handlers

import (
	"net/http"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---- Excalidraw --------------------------------------------------------------

type createExcalidrawReq struct {
	BoardID uuid.UUID `json:"boardId" binding:"required"`
	Title   string    `json:"title"`
}

// POST /api/v1/excalidraws
func (h *Handler) CreateExcalidraw(c *gin.Context) {
	userID := middleware.UserID(c)
	var req createExcalidrawReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "boardId is required")
		return
	}
	if _, err := h.ownedBoard(req.BoardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}

	var ci models.CanvasItem
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		ci = models.CanvasItem{
			BoardID:   req.BoardID,
			UserID:    userID,
			ItemType:  "excalidraw",
			SortOrder: h.nextSortOrder(tx, req.BoardID),
		}
		if err := tx.Create(&ci).Error; err != nil {
			return err
		}
		drawing := models.ExcalidrawItem{ID: ci.ID, Title: req.Title, SceneData: models.JSONB{}}
		return tx.Create(&drawing).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.itemMap(c.Request.Context(), ci))
}

type updateExcalidrawReq struct {
	Title     *string                `json:"title"`
	SceneData map[string]interface{} `json:"sceneData"`
	Thumbnail *string                `json:"thumbnail"`
}

// PUT /api/v1/excalidraws/:id
func (h *Handler) UpdateExcalidraw(c *gin.Context) {
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
	var req updateExcalidrawReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.SceneData != nil {
		updates["scene_data"] = models.JSONB(req.SceneData)
	}
	if req.Thumbnail != nil {
		updates["thumbnail"] = *req.Thumbnail
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&models.ExcalidrawItem{}).Where("id = ?", itemID).Updates(updates).Error; err != nil {
				return err
			}
			tx.Model(&models.CanvasItem{}).Where("id = ?", itemID).Update("updated_at", gorm.Expr("NOW()"))
		}
		return nil
	})
	if err != nil {
		serverError(c, err)
		return
	}
	ci, _ = h.ownedItem(itemID, userID)
	c.JSON(http.StatusOK, h.itemMap(c.Request.Context(), *ci))
}
