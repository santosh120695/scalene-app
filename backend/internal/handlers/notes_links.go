package handlers

import (
	"net/http"
	"strings"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"
	"knowledgecanvas/internal/scraper"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---- Notes ------------------------------------------------------------------

type createNoteReq struct {
	BoardID uuid.UUID `json:"boardId" binding:"required"`
	// When set, the new note is a sub-note nested inside this one.
	ParentItemID *uuid.UUID `json:"parentItemId"`
	Title        string     `json:"title"`
	Content      string     `json:"content"`
}

// POST /api/v1/notes
func (h *Handler) CreateNote(c *gin.Context) {
	userID := middleware.UserID(c)
	var req createNoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "boardId is required")
		return
	}
	if _, err := h.ownedBoard(req.BoardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}

	// A sub-note ALWAYS lands on its parent's board, so boardId is advisory once
	// parentItemId is set. That invariant is what keeps DeleteBoard correct
	// without changes (it deletes by board_id IN, so a subtree can never be
	// stranded on a board that isn't being deleted) and what lets the split view
	// carry one boardId in the route for both panes.
	boardID := req.BoardID
	if req.ParentItemID != nil {
		parent, err := h.ownedItem(*req.ParentItemID, userID)
		if err != nil {
			notFound(c, "Parent note not found")
			return
		}
		if parent.ItemType != "note" {
			badRequest(c, "Only a note can contain sub-notes")
			return
		}
		boardID = parent.BoardID
	}

	var ci models.CanvasItem
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		// No self-parent check needed: this row's id isn't minted until Create
		// below, and parent_item_id is never rewritten afterwards, so a cycle
		// cannot form.
		ci = models.CanvasItem{
			BoardID:      boardID,
			UserID:       userID,
			ParentItemID: req.ParentItemID,
			ItemType:     "note",
		}
		if req.ParentItemID != nil {
			ci.SortOrder = h.nextChildSortOrder(tx, *req.ParentItemID)
		} else {
			ci.SortOrder = h.nextSortOrder(tx, boardID)
		}
		if err := tx.Create(&ci).Error; err != nil {
			return err
		}
		content, err := h.syncTodosFromContent(tx, ci.ID, ci.BoardID, userID, req.Content)
		if err != nil {
			return err
		}
		if content, err = h.syncNoteLinks(tx, userID, content); err != nil {
			return err
		}
		note := models.NoteItem{ID: ci.ID, Title: req.Title, Content: content}
		return tx.Create(&note).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.itemMap(c.Request.Context(), ci))
}

type updateNoteReq struct {
	Title   *string `json:"title"`
	Content *string `json:"content"`
}

// PUT /api/v1/items/notes/:id
func (h *Handler) UpdateNote(c *gin.Context) {
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
	var req updateNoteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// A note's title is derived from its first block, so it changes often.
		// Compare against what's stored so the link refresh below only runs on a
		// real rename, not on every blur-save.
		var before models.NoteItem
		if err := tx.Select("title").First(&before, "id = ?", itemID).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{}
		if req.Title != nil {
			updates["title"] = *req.Title
		}
		if req.Content != nil {
			content, err := h.syncTodosFromContent(tx, ci.ID, ci.BoardID, userID, *req.Content)
			if err != nil {
				return err
			}
			if content, err = h.syncNoteLinks(tx, userID, content); err != nil {
				return err
			}
			updates["content"] = content
		}
		if len(updates) > 0 {
			if err := tx.Model(&models.NoteItem{}).Where("id = ?", itemID).Updates(updates).Error; err != nil {
				return err
			}
			tx.Model(&models.CanvasItem{}).Where("id = ?", itemID).Update("updated_at", gorm.Expr("NOW()"))
		}

		// Must come after the update above so the rewrite reads the new title.
		if req.Title != nil && *req.Title != before.Title {
			if err := h.refreshLinksTo(tx, userID, itemID); err != nil {
				return err
			}
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

// ---- Links ------------------------------------------------------------------

type createLinkReq struct {
	BoardID uuid.UUID `json:"boardId" binding:"required"`
	URL     string    `json:"url" binding:"required"`
}

// POST /api/v1/items/links — scrapes OG tags synchronously (PRD §4.3.1).
func (h *Handler) CreateLink(c *gin.Context) {
	userID := middleware.UserID(c)
	var req createLinkReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "boardId and url are required")
		return
	}
	req.URL = strings.TrimSpace(req.URL)
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		req.URL = "https://" + req.URL
	}
	if _, err := h.ownedBoard(req.BoardID, userID); err != nil {
		notFound(c, "Board not found")
		return
	}

	meta := scraper.Scrape(req.URL)

	var ci models.CanvasItem
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		ci = models.CanvasItem{
			BoardID:   req.BoardID,
			UserID:    userID,
			ItemType:  "link",
			SortOrder: h.nextSortOrder(tx, req.BoardID),
		}
		if err := tx.Create(&ci).Error; err != nil {
			return err
		}
		link := models.LinkItem{
			ID:           ci.ID,
			URL:          req.URL,
			Title:        meta.Title,
			Description:  meta.Description,
			ThumbnailURL: meta.Thumbnail,
			Domain:       meta.Domain,
			Content:      meta.Content,
			Byline:       meta.Byline,
		}
		return tx.Create(&link).Error
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, h.itemMap(c.Request.Context(), ci))
}

type updateLinkReq struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

// PUT /api/v1/items/links/:id
func (h *Handler) UpdateLink(c *gin.Context) {
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
	var req updateLinkReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}
	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if len(updates) > 0 {
		if err := h.DB.Model(&models.LinkItem{}).Where("id = ?", itemID).Updates(updates).Error; err != nil {
			serverError(c, err)
			return
		}
	}
	ci, _ := h.ownedItem(itemID, userID)
	c.JSON(http.StatusOK, h.itemMap(c.Request.Context(), *ci))
}
