package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

const (
	maxCommentRunes    = 4000
	maxQuotedTextRunes = 500
)

func commentJSON(cm *models.Comment, author *models.User) gin.H {
	out := gin.H{
		"id":           cm.ID,
		"itemId":       cm.ItemID,
		"anchorId":     cm.AnchorID,
		"isThreadRoot": cm.IsThreadRoot,
		"quotedText":   cm.QuotedText,
		"userId":       cm.UserID,
		"content":      cm.Content,
		"resolvedAt":   cm.ResolvedAt,
		"resolvedBy":   cm.ResolvedBy,
		"createdAt":    cm.CreatedAt,
		"updatedAt":    cm.UpdatedAt,
	}
	if author != nil {
		out["authorName"] = author.FullName
		out["authorEmail"] = author.Email
	}
	return out
}

// authorsByID fetches every referenced author in one query, so listing a note
// with many comments doesn't fan out into a lookup per row.
func (h *Handler) authorsByID(ids []uuid.UUID) map[uuid.UUID]models.User {
	out := make(map[uuid.UUID]models.User, len(ids))
	if len(ids) == 0 {
		return out
	}
	var users []models.User
	h.DB.Where("id IN ?", ids).Find(&users)
	for _, u := range users {
		out[u.ID] = u
	}
	return out
}

// mayModerateComment: a comment can be removed by its author or by the owner of
// the item it sits on — the note owner has to be able to clean up their own note.
func (h *Handler) mayModerateComment(cm *models.Comment, userID uuid.UUID) bool {
	if cm.UserID == userID {
		return true
	}
	_, err := h.ownedItem(cm.ItemID, userID)
	return err == nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

// GET /api/v1/items/:id/comments
//
// Returns a flat list ordered by (anchor, time). Threads are grouped and ordered
// client-side: they must appear in *document* order, which only the editor knows.
func (h *Handler) ListComments(c *gin.Context) {
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

	var rows []models.Comment
	if err := h.DB.Where("item_id = ?", itemID).
		Order("anchor_id, created_at ASC").Find(&rows).Error; err != nil {
		serverError(c, err)
		return
	}

	ids := make([]uuid.UUID, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].UserID)
		if rows[i].ResolvedBy != nil {
			ids = append(ids, *rows[i].ResolvedBy)
		}
	}
	authors := h.authorsByID(ids)

	out := make([]gin.H, 0, len(rows))
	for i := range rows {
		var author *models.User
		if a, ok := authors[rows[i].UserID]; ok {
			author = &a
		}
		out = append(out, commentJSON(&rows[i], author))
	}
	c.JSON(http.StatusOK, gin.H{"comments": out})
}

type createCommentReq struct {
	AnchorID   uuid.UUID `json:"anchorId" binding:"required"`
	QuotedText string    `json:"quotedText"`
	Content    string    `json:"content" binding:"required"`
}

// insertComment writes one comment, deciding thread-root status from the live
// row count for its anchor. forceReply skips that check — see CreateComment.
func (h *Handler) insertComment(itemID, userID uuid.UUID, req createCommentReq, forceReply bool) (models.Comment, error) {
	var cm models.Comment
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		isRoot := false
		if !forceReply {
			var n int64
			if err := tx.Model(&models.Comment{}).
				Where("item_id = ? AND anchor_id = ?", itemID, req.AnchorID).
				Count(&n).Error; err != nil {
				return err
			}
			isRoot = n == 0
		}
		cm = models.Comment{
			ItemID:       itemID,
			AnchorID:     req.AnchorID,
			IsThreadRoot: isRoot,
			UserID:       userID,
			Content:      truncateRunes(strings.TrimSpace(req.Content), maxCommentRunes),
		}
		// Only the root carries the quoted passage; replies inherit it from the thread.
		if isRoot {
			cm.QuotedText = truncateRunes(strings.TrimSpace(req.QuotedText), maxQuotedTextRunes)
		}
		return tx.Create(&cm).Error
	})
	return cm, err
}

// POST /api/v1/items/:id/comments
func (h *Handler) CreateComment(c *gin.Context) {
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
	var req createCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "anchorId and content are required")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		badRequest(c, "content is required")
		return
	}

	cm, err := h.insertComment(itemID, userID, req, false)
	if isUniqueViolation(err) {
		// uq_comments_thread_root_live rejected us: a concurrent request created
		// this anchor's root between our count and our insert, so this comment
		// is a reply to it.
		cm, err = h.insertComment(itemID, userID, req, true)
	}
	if err != nil {
		serverError(c, err)
		return
	}

	var author models.User
	h.DB.First(&author, "id = ?", userID)
	c.JSON(http.StatusCreated, commentJSON(&cm, &author))
}

type updateCommentReq struct {
	Content string `json:"content" binding:"required"`
}

// PATCH /api/v1/comments/:id
func (h *Handler) UpdateComment(c *gin.Context) {
	userID := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid id")
		return
	}
	var cm models.Comment
	if err := h.DB.First(&cm, "id = ?", id).Error; err != nil {
		notFound(c, "Comment not found")
		return
	}
	if cm.UserID != userID {
		forbidden(c)
		return
	}
	var req updateCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "content is required")
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		badRequest(c, "content is required")
		return
	}
	// anchorId and quotedText are immutable — the anchor is what ties the thread
	// to a passage of the note.
	cm.Content = truncateRunes(content, maxCommentRunes)
	if err := h.DB.Model(&cm).Update("content", cm.Content).Error; err != nil {
		serverError(c, err)
		return
	}

	var author models.User
	h.DB.First(&author, "id = ?", cm.UserID)
	c.JSON(http.StatusOK, commentJSON(&cm, &author))
}

// DELETE /api/v1/comments/:id
func (h *Handler) DeleteComment(c *gin.Context) {
	userID := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid id")
		return
	}
	var cm models.Comment
	if err := h.DB.First(&cm, "id = ?", id).Error; err != nil {
		notFound(c, "Comment not found")
		return
	}
	if !h.mayModerateComment(&cm, userID) {
		forbidden(c)
		return
	}

	// Deleting the anchoring comment strips the highlight, which would orphan
	// the rest of the thread — take the whole thread with it.
	if cm.IsThreadRoot {
		err = h.DB.Where("item_id = ? AND anchor_id = ?", cm.ItemID, cm.AnchorID).
			Delete(&models.Comment{}).Error
	} else {
		err = h.DB.Delete(&models.Comment{}, "id = ?", id).Error
	}
	if err != nil {
		serverError(c, err)
		return
	}
	// threadDeleted tells the client whether to strip the <mark> from the note.
	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"threadDeleted": cm.IsThreadRoot,
		"anchorId":      cm.AnchorID,
	})
}

type resolveCommentReq struct {
	Resolved *bool `json:"resolved" binding:"required"`
}

// PATCH /api/v1/comments/:id/resolve
func (h *Handler) ResolveComment(c *gin.Context) {
	userID := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid id")
		return
	}
	var cm models.Comment
	if err := h.DB.First(&cm, "id = ?", id).Error; err != nil {
		notFound(c, "Comment not found")
		return
	}
	if !cm.IsThreadRoot {
		badRequest(c, "Only a thread's first comment can be resolved")
		return
	}
	// Resolving is a workflow action on the note, not an authorship claim — the
	// person acting on the feedback is the one who closes the thread.
	if _, err := h.ownedItem(cm.ItemID, userID); err != nil {
		forbidden(c)
		return
	}
	var req resolveCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "resolved is required")
		return
	}

	var resolvedAt *time.Time
	var resolvedBy *uuid.UUID
	if *req.Resolved {
		now := time.Now()
		resolvedAt, resolvedBy = &now, &userID
	}
	// Must be a map: GORM's struct Updates skips zero values, so nil would never
	// be written back when unresolving.
	if err := h.DB.Model(&cm).Updates(map[string]any{
		"resolved_at": resolvedAt,
		"resolved_by": resolvedBy,
	}).Error; err != nil {
		serverError(c, err)
		return
	}
	cm.ResolvedAt, cm.ResolvedBy = resolvedAt, resolvedBy

	var author models.User
	h.DB.First(&author, "id = ?", cm.UserID)
	c.JSON(http.StatusOK, commentJSON(&cm, &author))
}
