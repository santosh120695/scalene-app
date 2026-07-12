package handlers

import (
	"fmt"
	"html"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// dateLayout is the wire format for a journal day's calendar date (no time).
const dateLayout = "2006-01-02"

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// clientDate resolves "today" in the client's timezone. The X-Client-TZ-Offset
// header carries minutes as returned by JS Date.getTimezoneOffset() (UTC minus
// local, so IST = -330). Missing/invalid header falls back to UTC. Returns the
// day both as a midnight-UTC time.Time (for the DATE column) and as a string.
func clientDate(c *gin.Context) (time.Time, string) {
	return resolveDate(c.GetHeader("X-Client-TZ-Offset"), time.Now())
}

// resolveDate is the pure core of clientDate: given the raw X-Client-TZ-Offset
// header (minutes, UTC minus local per JS getTimezoneOffset) and the current
// instant, it returns the client's local calendar day as midnight-UTC and its
// wire string. A missing/invalid offset falls back to UTC.
func resolveDate(offsetHeader string, now time.Time) (time.Time, string) {
	offsetMin := 0
	if raw := strings.TrimSpace(offsetHeader); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			offsetMin = v
		}
	}
	local := now.UTC().Add(time.Duration(-offsetMin) * time.Minute)
	y, m, d := local.Date()
	day := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	return day, day.Format(dateLayout)
}

// wordCount counts words in the plain text of Tiptap HTML content.
func wordCount(contentHTML string) int {
	text := htmlTagRe.ReplaceAllString(contentHTML, " ")
	text = html.UnescapeString(text)
	return len(strings.Fields(text))
}

// scaffoldFromTemplate builds initial Tiptap HTML from a template's sections.
// Each section renders its heading (if any) as an <h2> followed by an empty
// paragraph the user writes into. An empty/blank template yields one paragraph.
func scaffoldFromTemplate(tmpl models.JSONB) string {
	sections, ok := tmpl["sections"].([]interface{})
	if !ok || len(sections) == 0 {
		return "<p></p>"
	}
	var b strings.Builder
	for _, s := range sections {
		sec, ok := s.(map[string]interface{})
		if !ok {
			continue
		}
		if heading, _ := sec["heading"].(string); strings.TrimSpace(heading) != "" {
			b.WriteString("<h2>")
			b.WriteString(html.EscapeString(heading))
			b.WriteString("</h2>")
		}
		b.WriteString("<p></p>")
	}
	if b.Len() == 0 {
		return "<p></p>"
	}
	return b.String()
}

// ---- ownership guards -------------------------------------------------------

func (h *Handler) ownedJournalItem(itemID, userID uuid.UUID) (*models.JournalItem, error) {
	var it models.JournalItem
	if err := h.DB.First(&it, "id = ?", itemID).Error; err != nil {
		return nil, err
	}
	if it.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	return &it, nil
}

// ---- aggregate maintenance --------------------------------------------------

// recalcDay recomputes the day's item_count and total_words from its items, in
// the caller's transaction. If the day has no items left, the day row is
// deleted. Call after every item create/content-change/delete.
func (h *Handler) recalcDay(tx *gorm.DB, dayID uuid.UUID) error {
	var items []models.JournalItem
	if err := tx.Where("journal_day_id = ?", dayID).Find(&items).Error; err != nil {
		return err
	}
	if len(items) == 0 {
		return tx.Delete(&models.JournalDay{}, "id = ?", dayID).Error
	}
	words := 0
	for _, it := range items {
		words += wordCount(it.Content)
	}
	return tx.Model(&models.JournalDay{}).Where("id = ?", dayID).
		Updates(map[string]interface{}{
			"item_count":  len(items),
			"total_words": words,
			"updated_at":  gorm.Expr("NOW()"),
		}).Error
}

// ---- DTO assembly -----------------------------------------------------------

func journalItemMap(it models.JournalItem) gin.H {
	return gin.H{
		"id":           it.ID,
		"journalDayId": it.JournalDayID,
		"userId":       it.UserID,
		"title":        it.Title,
		"content":      it.Content,
		"styleConfig":  it.StyleConfig,
		"sortOrder":    it.SortOrder,
		"createdAt":    it.CreatedAt,
		"updatedAt":    it.UpdatedAt,
	}
}

// contentPreview returns a short plain-text excerpt of an item's content.
func contentPreview(contentHTML string) string {
	text := strings.TrimSpace(html.UnescapeString(htmlTagRe.ReplaceAllString(contentHTML, " ")))
	text = strings.Join(strings.Fields(text), " ")
	if len(text) > 160 {
		return text[:160] + "…"
	}
	return text
}

// ---- Templates --------------------------------------------------------------

// GET /api/v1/journal/templates
func (h *Handler) ListJournalTemplates(c *gin.Context) {
	var tmpls []models.JournalTemplate
	if err := h.DB.Order("sort_order ASC, created_at ASC").Find(&tmpls).Error; err != nil {
		serverError(c, err)
		return
	}
	out := make([]gin.H, 0, len(tmpls))
	for _, t := range tmpls {
		out = append(out, gin.H{
			"id":        t.ID,
			"name":      t.Name,
			"template":  t.Template,
			"sortOrder": t.SortOrder,
		})
	}
	c.JSON(http.StatusOK, out)
}

// ---- Days -------------------------------------------------------------------

// GET /api/v1/journal/days?days=7
func (h *Handler) ListJournalDays(c *gin.Context) {
	userID := middleware.UserID(c)
	limit := 7
	if raw := c.Query("days"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 90 {
			limit = v
		}
	}

	var days []models.JournalDay
	if err := h.DB.Where("user_id = ?", userID).
		Order("date DESC").Limit(limit).Find(&days).Error; err != nil {
		serverError(c, err)
		return
	}

	out := make([]gin.H, 0, len(days))
	for _, d := range days {
		var latest models.JournalItem
		card := gin.H{
			"id":         d.ID,
			"date":       d.Date.Format(dateLayout),
			"itemCount":  d.ItemCount,
			"totalWords": d.TotalWords,
			"latestItem": nil,
		}
		if err := h.DB.Where("journal_day_id = ?", d.ID).
			Order("sort_order DESC, created_at DESC").First(&latest).Error; err == nil {
			card["latestItem"] = gin.H{
				"id":             latest.ID,
				"title":          latest.Title,
				"contentPreview": contentPreview(latest.Content),
			}
		}
		out = append(out, card)
	}
	c.JSON(http.StatusOK, out)
}

// GET /api/v1/journal/days/today
func (h *Handler) GetTodayJournalDay(c *gin.Context) {
	userID := middleware.UserID(c)
	_, todayStr := clientDate(c)

	var day models.JournalDay
	if err := h.DB.Where("user_id = ? AND date = ?", userID, todayStr).First(&day).Error; err != nil {
		notFound(c, "No journal entry for today")
		return
	}

	var items []models.JournalItem
	if err := h.DB.Where("journal_day_id = ?", day.ID).
		Order("sort_order ASC, created_at ASC").Find(&items).Error; err != nil {
		serverError(c, err)
		return
	}
	itemMaps := make([]gin.H, 0, len(items))
	for _, it := range items {
		itemMaps = append(itemMaps, journalItemMap(it))
	}
	c.JSON(http.StatusOK, gin.H{
		"id":         day.ID,
		"date":       day.Date.Format(dateLayout),
		"itemCount":  day.ItemCount,
		"totalWords": day.TotalWords,
		"items":      itemMaps,
	})
}

// ---- Items ------------------------------------------------------------------

type createJournalItemReq struct {
	TemplateID uuid.UUID `json:"templateId" binding:"required"`
	Title      string    `json:"title"`
}

// POST /api/v1/journal/items — creates today's day (idempotent) and a new item
// scaffolded from the template, with style snapshot from the user's prefs.
func (h *Handler) CreateJournalItem(c *gin.Context) {
	userID := middleware.UserID(c)
	today, todayStr := clientDate(c)

	var req createJournalItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "templateId is required")
		return
	}

	var tmpl models.JournalTemplate
	if err := h.DB.First(&tmpl, "id = ?", req.TemplateID).Error; err != nil {
		notFound(c, "Template not found")
		return
	}

	// Snapshot the default look from the user's preferences (if any). The
	// originating template id is stashed here too so the editor's "set as
	// default" can persist template + look together after a reload.
	styleSnapshot := models.JSONB{"templateId": req.TemplateID.String()}
	var pref models.JournalPreference
	if err := h.DB.Where("user_id = ?", userID).First(&pref).Error; err == nil {
		if bd, ok := pref.PreferenceConfig["backdrop"]; ok {
			styleSnapshot["backdrop"] = bd
		}
		if fk, ok := pref.PreferenceConfig["fontKey"]; ok {
			styleSnapshot["fontKey"] = fk
		}
	}

	var item models.JournalItem
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		// Idempotent day creation: the unique (user_id, date) constraint makes
		// two rapid creates at rollover collapse to one day.
		day := models.JournalDay{UserID: userID, Date: today}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "date"}},
			DoNothing: true,
		}).Create(&day).Error; err != nil {
			return err
		}
		if day.ID == uuid.Nil {
			if err := tx.Where("user_id = ? AND date = ?", userID, todayStr).First(&day).Error; err != nil {
				return err
			}
		}

		var maxSort *int
		tx.Model(&models.JournalItem{}).Where("journal_day_id = ?", day.ID).
			Select("MAX(sort_order)").Scan(&maxSort)
		sortOrder := 0
		if maxSort != nil {
			sortOrder = *maxSort + 1
		}

		item = models.JournalItem{
			JournalDayID: day.ID,
			UserID:       userID,
			Title:        req.Title,
			Content:      scaffoldFromTemplate(tmpl.Template),
			StyleConfig:  styleSnapshot,
			SortOrder:    sortOrder,
		}
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
		return h.recalcDay(tx, day.ID)
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, journalItemMap(item))
}

type updateJournalItemReq struct {
	Title       *string       `json:"title"`
	Content     *string       `json:"content"`
	StyleConfig *models.JSONB `json:"styleConfig"`
}

// PATCH /api/v1/journal/items/:id — autosave title/content + customization.
func (h *Handler) UpdateJournalItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	item, err := h.ownedJournalItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}

	var req updateJournalItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{}
		if req.Title != nil {
			updates["title"] = *req.Title
		}
		contentChanged := false
		if req.Content != nil {
			updates["content"] = *req.Content
			contentChanged = true
		}
		if req.StyleConfig != nil {
			updates["style_config"] = *req.StyleConfig
		}
		if len(updates) == 0 {
			return nil
		}
		updates["updated_at"] = gorm.Expr("NOW()")
		if err := tx.Model(&models.JournalItem{}).Where("id = ?", itemID).Updates(updates).Error; err != nil {
			return err
		}
		if contentChanged {
			return h.recalcDay(tx, item.JournalDayID)
		}
		return nil
	})
	if err != nil {
		serverError(c, err)
		return
	}
	item, _ = h.ownedJournalItem(itemID, userID)
	c.JSON(http.StatusOK, journalItemMap(*item))
}

// DELETE /api/v1/journal/items/:id — deletes item, recalculates aggregates,
// removes the day if it becomes empty.
func (h *Handler) DeleteJournalItem(c *gin.Context) {
	userID := middleware.UserID(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "Invalid item id")
		return
	}
	item, err := h.ownedJournalItem(itemID, userID)
	if err != nil {
		notFound(c, "Item not found")
		return
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.JournalItem{}, "id = ?", itemID).Error; err != nil {
			return err
		}
		return h.recalcDay(tx, item.JournalDayID)
	})
	if err != nil {
		serverError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ---- Preferences ------------------------------------------------------------

// GET /api/v1/journal/preferences
func (h *Handler) GetJournalPreferences(c *gin.Context) {
	userID := middleware.UserID(c)
	var pref models.JournalPreference
	if err := h.DB.Where("user_id = ?", userID).First(&pref).Error; err != nil {
		// No prefs saved yet — return empty config rather than 404.
		c.JSON(http.StatusOK, gin.H{"preferenceConfig": models.JSONB{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preferenceConfig": pref.PreferenceConfig})
}

type updateJournalPrefsReq struct {
	PreferenceConfig models.JSONB `json:"preferenceConfig"`
}

// PUT /api/v1/journal/preferences — upsert on user_id.
func (h *Handler) UpdateJournalPreferences(c *gin.Context) {
	userID := middleware.UserID(c)
	var req updateJournalPrefsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Invalid request body")
		return
	}
	if req.PreferenceConfig == nil {
		req.PreferenceConfig = models.JSONB{}
	}

	pref := models.JournalPreference{UserID: userID, PreferenceConfig: req.PreferenceConfig}
	if err := h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"preference_config", "updated_at"}),
	}).Create(&pref).Error; err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"preferenceConfig": pref.PreferenceConfig})
}

// ---- Backdrop upload --------------------------------------------------------

// POST /api/v1/journal/backdrops — upload a custom backdrop image. Reuses the
// editor_images blob + serve route so the persisted URL never expires (the
// /editor/images/:id route re-presigns on each fetch). Returns the id; the
// client composes the durable serve URL, mirroring UploadEditorImage.
func (h *Handler) UploadJournalBackdrop(c *gin.Context) {
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
	key := fmt.Sprintf("%s/journal-backdrops/%s.%s", userID, imgID, ext)
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
	c.JSON(http.StatusCreated, gin.H{"id": imgID})
}
