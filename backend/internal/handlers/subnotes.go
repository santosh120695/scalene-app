package handlers

import (
	"net/http"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func subNoteJSON(s *models.SubNote, author *models.User) gin.H {
	out := gin.H{
		"id":        s.ID,
		"itemId":    s.ItemID,
		"userId":    s.UserID,
		"content":   s.Content,
		"highlight": s.Highlight,
		"createdAt": s.CreatedAt,
		"updatedAt": s.UpdatedAt,
	}
	if author != nil {
		out["authorName"] = author.FullName
		out["authorEmail"] = author.Email
	}
	return out
}

// GET /api/v1/items/:itemId/sub-notes
func (h *Handler) ListSubNotes(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	if _, err := h.ownedItem(itemID, userID); err != nil {
		notFound(c, "Item not found")
		return
	}
	var notes []models.SubNote
	h.DB.Where("item_id = ?", itemID).Order("created_at ASC").Find(&notes)

	out := make([]gin.H, 0, len(notes))
	for i := range notes {
		var author models.User
		h.DB.First(&author, "id = ?", notes[i].UserID)
		out = append(out, subNoteJSON(&notes[i], &author))
	}
	c.JSON(http.StatusOK, gin.H{"subNotes": out})
}

type createSubNoteReq struct {
	Content   string `json:"content" binding:"required"`
	Highlight string `json:"highlight"`
}

// POST /api/v1/items/:itemId/sub-notes
func (h *Handler) CreateSubNote(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	if _, err := h.ownedItem(itemID, userID); err != nil {
		notFound(c, "Item not found")
		return
	}
	var req createSubNoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "content is required")
		return
	}
	note := models.SubNote{ItemID: itemID, UserID: userID, Content: req.Content, Highlight: req.Highlight}
	if err := h.DB.Create(&note).Error; err != nil {
		serverError(c, err)
		return
	}
	var author models.User
	h.DB.First(&author, "id = ?", userID)
	c.JSON(http.StatusCreated, subNoteJSON(&note, &author))
}

type updateSubNoteReq struct {
	Content string `json:"content" binding:"required"`
}

// PUT /api/v1/sub-notes/:id
func (h *Handler) UpdateSubNote(c *gin.Context) {
	userID := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid id")
		return
	}
	var note models.SubNote
	if err := h.DB.First(&note, "id = ?", id).Error; err != nil {
		notFound(c, "Sub-note not found")
		return
	}
	if note.UserID != userID {
		forbidden(c)
		return
	}
	var req updateSubNoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "content is required")
		return
	}
	h.DB.Model(&note).Update("content", req.Content)
	var author models.User
	h.DB.First(&author, "id = ?", userID)
	c.JSON(http.StatusOK, subNoteJSON(&note, &author))
}

// DELETE /api/v1/sub-notes/:id
func (h *Handler) DeleteSubNote(c *gin.Context) {
	userID := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid id")
		return
	}
	var note models.SubNote
	if err := h.DB.First(&note, "id = ?", id).Error; err != nil {
		notFound(c, "Sub-note not found")
		return
	}
	if note.UserID != userID {
		forbidden(c)
		return
	}
	h.DB.Delete(&models.SubNote{}, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
