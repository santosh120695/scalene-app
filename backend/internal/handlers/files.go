package handlers

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"
	"knowledgecanvas/internal/pdfutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/image/webp" // registers webp decoder
	"gorm.io/gorm"
)

const (
	maxPDFSize   = 50 << 20 // 50MB
	maxImageSize = 10 << 20 // 10MB
)

var _ = webp.Decode // keep webp import referenced

// readUpload reads a multipart file field with a size cap.
func readUpload(c *gin.Context, max int64) ([]byte, string, error) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		return nil, "", fmt.Errorf("no file provided")
	}
	defer file.Close()
	if header.Size > max {
		return nil, "", fmt.Errorf("file exceeds the %d MB limit", max>>20)
	}
	data, err := io.ReadAll(io.LimitReader(file, max+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > max {
		return nil, "", fmt.Errorf("file exceeds the %d MB limit", max>>20)
	}
	return data, header.Filename, nil
}

// POST /api/v1/items/pdfs (multipart)
func (h *Handler) CreatePDF(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.PostForm("boardId"))
	if err != nil {
		badRequest(c, "boardId is required")
		return
	}
	if _, err := h.ownedBoard(boardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}

	data, filename, err := readUpload(c, maxPDFSize)
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	if ct := http.DetectContentType(data); !strings.HasPrefix(ct, "application/pdf") {
		badRequest(c, "Uploaded file is not a valid PDF")
		return
	}

	itemID := uuid.New()
	key := fmt.Sprintf("%s/pdfs/%s.pdf", userID, itemID)
	ctx := c.Request.Context()
	if _, err := h.Storage.Upload(ctx, key, data, "application/pdf"); err != nil {
		serverError(c, err)
		return
	}

	pageCount := pdfutil.PageCount(data)

	var ci models.CanvasItem
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		ci = models.CanvasItem{
			ID:        itemID,
			BoardID:   boardID,
			UserID:    userID,
			ItemType:  "pdf",
			SortOrder: h.nextSortOrder(tx, boardID),
		}
		if err := tx.Create(&ci).Error; err != nil {
			return err
		}
		pdf := models.PdfItem{
			ID:        itemID,
			Title:     filename,
			FilePath:  key,
			FileSize:  int64(len(data)),
			PageCount: pageCount,
		}
		return tx.Create(&pdf).Error
	})
	if err != nil {
		_ = h.Storage.Delete(ctx, key)
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.itemMap(ctx, ci))
}

// PUT /api/v1/items/pdfs/:id — update title.
func (h *Handler) UpdatePDF(c *gin.Context) {
	h.updateTitle(c, &models.PdfItem{})
}

// POST /api/v1/items/images (multipart)
func (h *Handler) CreateImage(c *gin.Context) {
	userID := middleware.UserID(c)
	boardID, err := uuid.Parse(c.PostForm("boardId"))
	if err != nil {
		badRequest(c, "boardId is required")
		return
	}
	if _, err := h.ownedBoard(boardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}
	caption := c.PostForm("caption")

	data, filename, err := readUpload(c, maxImageSize)
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	mimeType := http.DetectContentType(data)
	if !strings.HasPrefix(mimeType, "image/") {
		badRequest(c, "Uploaded file is not a valid image")
		return
	}

	width, height := 0, 0
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(data)); err == nil {
		width, height = cfg.Width, cfg.Height
	}

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))
	if ext == "" {
		ext = "jpg"
	}
	itemID := uuid.New()
	key := fmt.Sprintf("%s/images/%s.%s", userID, itemID, ext)
	ctx := c.Request.Context()
	if _, err := h.Storage.Upload(ctx, key, data, mimeType); err != nil {
		serverError(c, err)
		return
	}

	var ci models.CanvasItem
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		ci = models.CanvasItem{
			ID:        itemID,
			BoardID:   boardID,
			UserID:    userID,
			ItemType:  "image",
			SortOrder: h.nextSortOrder(tx, boardID),
		}
		if err := tx.Create(&ci).Error; err != nil {
			return err
		}
		img := models.ImageItem{
			ID:       itemID,
			Caption:  caption,
			FilePath: key,
			FileSize: int64(len(data)),
			MimeType: mimeType,
			WidthPx:  width,
			HeightPx: height,
		}
		return tx.Create(&img).Error
	})
	if err != nil {
		_ = h.Storage.Delete(ctx, key)
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.itemMap(ctx, ci))
}

type updateCaptionReq struct {
	Caption string `json:"caption"`
}

// PUT /api/v1/items/images/:id — update caption.
func (h *Handler) UpdateImage(c *gin.Context) {
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
	var req updateCaptionReq
	_ = c.ShouldBindJSON(&req)
	if err := h.DB.Model(&models.ImageItem{}).Where("id = ?", itemID).
		Update("caption", req.Caption).Error; err != nil {
		serverError(c, err)
		return
	}
	ci, _ := h.ownedItem(itemID, userID)
	c.JSON(http.StatusOK, h.itemMap(c.Request.Context(), *ci))
}

// POST /api/v1/editor/images (multipart) — upload an image to embed inline in
// TipTap note content. Returns a stable, non-expiring URL pointing at the
// serve route below (which redirects to a freshly presigned URL on each load).
func (h *Handler) UploadEditorImage(c *gin.Context) {
	userID := middleware.UserID(c)

	data, filename, err := readUpload(c, maxImageSize)
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	mimeType := http.DetectContentType(data)
	if !strings.HasPrefix(mimeType, "image/") {
		badRequest(c, "Uploaded file is not a valid image")
		return
	}

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))
	if ext == "" {
		ext = "jpg"
	}
	imgID := uuid.New()
	key := fmt.Sprintf("%s/editor/%s.%s", userID, imgID, ext)
	ctx := c.Request.Context()
	if _, err := h.Storage.Upload(ctx, key, data, mimeType); err != nil {
		serverError(c, err)
		return
	}

	img := models.EditorImage{
		ID:       imgID,
		UserID:   userID,
		FilePath: key,
		MimeType: mimeType,
		FileSize: int64(len(data)),
	}
	if err := h.DB.Create(&img).Error; err != nil {
		_ = h.Storage.Delete(ctx, key)
		serverError(c, err)
		return
	}

	// The client composes the browser-facing URL from its own API base
	// (frontend and API are separate origins), so we return just the id.
	c.JSON(http.StatusCreated, gin.H{"id": imgID})
}

// GET /api/v1/editor/images/:id — public serve route for inline note images.
// Intentionally unauthenticated: <img> tags cannot send a Bearer header, and
// the id is an unguessable UUID (same possession-based model as presigned URLs
// and the local /files route). Redirects to a freshly presigned object URL.
func (h *Handler) ServeEditorImage(c *gin.Context) {
	imgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		notFound(c, "Image not found")
		return
	}
	var img models.EditorImage
	if err := h.DB.First(&img, "id = ?", imgID).Error; err != nil {
		notFound(c, "Image not found")
		return
	}
	url := h.sign(c.Request.Context(), img.FilePath, 24)
	if url == "" {
		serverError(c, fmt.Errorf("could not resolve image url"))
		return
	}
	c.Redirect(http.StatusFound, url)
}

type updateTitleReq struct {
	Title string `json:"title"`
}

// updateTitle is shared by PDF title updates.
func (h *Handler) updateTitle(c *gin.Context, _ interface{}) {
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
	var req updateTitleReq
	_ = c.ShouldBindJSON(&req)
	if err := h.DB.Model(&models.PdfItem{}).Where("id = ?", itemID).
		Update("title", req.Title).Error; err != nil {
		serverError(c, err)
		return
	}
	ci, _ := h.ownedItem(itemID, userID)
	c.JSON(http.StatusOK, h.itemMap(c.Request.Context(), *ci))
}
