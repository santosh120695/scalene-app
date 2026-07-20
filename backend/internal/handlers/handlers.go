package handlers

import (
	"context"
	"knowledgecanvas/config"
	"knowledgecanvas/internal/models"
	"knowledgecanvas/internal/storage"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	DB      *gorm.DB
	Cfg     *config.Config
	Storage storage.Storage
}

func New(db *gorm.DB, cfg *config.Config, st storage.Storage) *Handler {
	return &Handler{DB: db, Cfg: cfg, Storage: st}
}

func fail(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": code, "message": message})
}

func badRequest(c *gin.Context, message string) {
	fail(c, http.StatusBadRequest, "bad_request", message)
}
func notFound(c *gin.Context, message string) { fail(c, http.StatusNotFound, "not_found", message) }

func forbidden(c *gin.Context) {
	fail(c, http.StatusForbidden, "forbidden", "You do not have access to this resource")
}

func serverError(c *gin.Context, err error) {
	fail(c, http.StatusInternalServerError, "server_error", err.Error())
}

// ---- ownership guard --------------------------------------------------------

// ownedBoard loads a board and verifies it belongs to userID.
func (h *Handler) ownedBoard(boardID, userID uuid.UUID) (*models.Board, error) {
	var b models.Board
	if err := h.DB.First(&b, "id = ?", boardID).Error; err != nil {
		return nil, err
	}
	if b.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	return &b, nil
}

// ownedItem loads a canvas item and verifies it belongs to userID.
func (h *Handler) ownedItem(itemID, userID uuid.UUID) (*models.CanvasItem, error) {
	var ci models.CanvasItem
	if err := h.DB.First(&ci, "id = ?", itemID).Error; err != nil {
		return nil, err
	}
	if ci.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	return &ci, nil
}

// sign turns a storage key into a presigned URL (empty key -> empty string).
func (h *Handler) sign(ctx context.Context, key string, ttl int) string {
	if key == "" {
		return ""
	}
	url, err := h.Storage.PresignGet(ctx, key, durationFromHours(ttl))
	if err != nil {
		return ""
	}
	return url
}

func (h *Handler) itemMap(ctx context.Context, ci models.CanvasItem) gin.H {
	base := gin.H{
		"id":         ci.ID,
		"boardId":    ci.BoardID,
		"userId":     ci.UserID,
		"itemType":   ci.ItemType,
		"sortOrder":  ci.SortOrder,
		"colorLabel": ci.ColorLabel,
		"isPinned":   ci.IsPinned,
		"createdAt":  ci.CreatedAt,
		"updatedAt":  ci.UpdatedAt,
	}

	switch ci.ItemType {
	case "note":
		var n models.NoteItem
		if h.DB.First(&n, "id = ?", ci.ID).Error == nil {
			base["title"] = n.Title
			base["content"] = n.Content
		}
	case "link":
		var l models.LinkItem
		if h.DB.First(&l, "id = ?", ci.ID).Error == nil {
			base["url"] = l.URL
			base["title"] = l.Title
			base["description"] = l.Description
			base["thumbnailUrl"] = l.ThumbnailURL // external OG image — already a URL
			base["domain"] = l.Domain
			base["content"] = l.Content
			base["byline"] = l.Byline
		}
	case "pdf":
		var p models.PdfItem
		if h.DB.First(&p, "id = ?", ci.ID).Error == nil {
			base["title"] = p.Title
			base["filePath"] = h.sign(ctx, p.FilePath, 24)
			base["fileSize"] = p.FileSize
			base["pageCount"] = p.PageCount
			base["thumbnailUrl"] = h.sign(ctx, p.ThumbnailURL, 168)
		}
	case "image":
		var im models.ImageItem
		if h.DB.First(&im, "id = ?", ci.ID).Error == nil {
			base["caption"] = im.Caption
			base["filePath"] = h.sign(ctx, im.FilePath, 24)
			base["fileSize"] = im.FileSize
			base["mimeType"] = im.MimeType
			base["widthPx"] = im.WidthPx
			base["heightPx"] = im.HeightPx
			base["thumbnailUrl"] = h.sign(ctx, im.ThumbnailURL, 168)
		}
	case "excalidraw":
		var e models.ExcalidrawItem
		if h.DB.First(&e, "id = ?", ci.ID).Error == nil {
			base["title"] = e.Title
			base["sceneData"] = e.SceneData
			base["thumbnail"] = e.Thumbnail
		}
	}
	return base
}

func (h *Handler) nextSortOrder(tx *gorm.DB, boardID uuid.UUID) int {
	var max *int
	tx.Model(&models.CanvasItem{}).
		Where("board_id = ?", boardID).
		Select("MAX(sort_order)").Scan(&max)
	if max == nil {
		return 0
	}
	return *max + 1
}
