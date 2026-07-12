package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"knowledgecanvas/internal/database"
	"knowledgecanvas/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// setupJournalDB connects to the Postgres pointed at by TEST_DATABASE_URL and
// applies migrations. Tests that touch the DB are skipped when it is unset, so
// `go test ./...` stays green without a database (matching the existing suite).
func setupJournalDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed journal test")
	}
	db, err := database.Connect(dsn, false)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// makeUser inserts a throwaway user and registers cleanup of all their journal
// data plus the user row.
func makeUser(t *testing.T, db *gorm.DB) uuid.UUID {
	t.Helper()
	u := models.User{
		ID:           uuid.New(),
		Email:        "journal-" + uuid.NewString() + "@test.local",
		PasswordHash: "x",
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		db.Where("user_id = ?", u.ID).Delete(&models.JournalItem{})
		db.Where("user_id = ?", u.ID).Delete(&models.JournalDay{})
		db.Where("user_id = ?", u.ID).Delete(&models.JournalPreference{})
		db.Delete(&models.User{}, "id = ?", u.ID)
	})
	return u.ID
}

// seedTemplate inserts a template and cleans it up.
func seedTemplate(t *testing.T, db *gorm.DB, sections models.JSONB) uuid.UUID {
	t.Helper()
	tmpl := models.JournalTemplate{ID: uuid.New(), Name: "Test", Template: sections}
	if err := db.Create(&tmpl).Error; err != nil {
		t.Fatalf("create template: %v", err)
	}
	t.Cleanup(func() { db.Delete(&models.JournalTemplate{}, "id = ?", tmpl.ID) })
	return tmpl.ID
}

// ctxFor builds a gin context with the given user, body and params for calling a
// handler method directly.
func ctxFor(method, body string, userID uuid.UUID, params gin.Params) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, "/", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", userID)
	c.Params = params
	return c, w
}

func createItem(t *testing.T, h *Handler, userID, templateID uuid.UUID, title string) models.JournalItem {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"templateId": templateID.String(), "title": title})
	c, w := ctxFor(http.MethodPost, string(body), userID, nil)
	h.CreateJournalItem(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateJournalItem: status %d body %s", w.Code, w.Body.String())
	}
	var it models.JournalItem
	if err := json.Unmarshal(w.Body.Bytes(), &it); err != nil {
		t.Fatalf("decode item: %v", err)
	}
	return it
}

func loadDay(t *testing.T, db *gorm.DB, dayID uuid.UUID) (models.JournalDay, bool) {
	t.Helper()
	var d models.JournalDay
	err := db.First(&d, "id = ?", dayID).Error
	if err == gorm.ErrRecordNotFound {
		return d, false
	}
	if err != nil {
		t.Fatalf("load day: %v", err)
	}
	return d, true
}

func TestAggregateRecalculation(t *testing.T) {
	db := setupJournalDB(t)
	h := &Handler{DB: db}
	userID := makeUser(t, db)
	// A wordless scaffold (blank heading -> "<p></p>") so each fresh item starts
	// at 0 words and the aggregate reflects only what we type.
	tmplID := seedTemplate(t, db, models.JSONB{"sections": []interface{}{
		map[string]interface{}{"heading": ""},
	}})

	// Create two items in the same day.
	i1 := createItem(t, h, userID, tmplID, "one")
	i2 := createItem(t, h, userID, tmplID, "two")
	if i1.JournalDayID != i2.JournalDayID {
		t.Fatalf("expected both items in the same day")
	}
	dayID := i1.JournalDayID

	if d, _ := loadDay(t, db, dayID); d.ItemCount != 2 {
		t.Errorf("after 2 creates itemCount = %d, want 2", d.ItemCount)
	}

	// Edit content -> words recalculated.
	patch := `{"content":"<p>alpha beta gamma</p>"}`
	c, w := ctxFor(http.MethodPatch, patch, userID, gin.Params{{Key: "id", Value: i1.ID.String()}})
	h.UpdateJournalItem(c)
	if w.Code != http.StatusOK {
		t.Fatalf("patch status %d: %s", w.Code, w.Body.String())
	}
	if d, _ := loadDay(t, db, dayID); d.TotalWords != 3 {
		t.Errorf("after edit totalWords = %d, want 3", d.TotalWords)
	}

	// Delete one item -> count drops, day still present. (A 204 with no body
	// isn't flushed to the recorder when handlers are called directly, so we
	// assert on the resulting DB state rather than the status code.)
	c, _ = ctxFor(http.MethodDelete, "", userID, gin.Params{{Key: "id", Value: i2.ID.String()}})
	h.DeleteJournalItem(c)
	if d, ok := loadDay(t, db, dayID); !ok || d.ItemCount != 1 {
		t.Errorf("after 1 delete itemCount = %d ok=%v, want 1", d.ItemCount, ok)
	}

	// Delete the last item -> day row is removed.
	c, _ = ctxFor(http.MethodDelete, "", userID, gin.Params{{Key: "id", Value: i1.ID.String()}})
	h.DeleteJournalItem(c)
	if _, ok := loadDay(t, db, dayID); ok {
		t.Errorf("empty day should have been deleted")
	}
}

func TestIdempotentDayCreation(t *testing.T) {
	db := setupJournalDB(t)
	h := &Handler{DB: db}
	userID := makeUser(t, db)
	tmplID := seedTemplate(t, db, models.JSONB{"sections": []interface{}{}})

	// Two rapid concurrent creates must not create two journal_days.
	var wg sync.WaitGroup
	dayIDs := make([]uuid.UUID, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			body, _ := json.Marshal(map[string]string{"templateId": tmplID.String()})
			c, w := ctxFor(http.MethodPost, string(body), userID, nil)
			h.CreateJournalItem(c)
			if w.Code == http.StatusCreated {
				var it models.JournalItem
				_ = json.Unmarshal(w.Body.Bytes(), &it)
				dayIDs[idx] = it.JournalDayID
			}
		}(i)
	}
	wg.Wait()

	var count int64
	db.Model(&models.JournalDay{}).Where("user_id = ?", userID).Count(&count)
	if count != 1 {
		t.Errorf("expected exactly 1 journal_day after concurrent creates, got %d", count)
	}
}

func TestCrossUserIsolation(t *testing.T) {
	db := setupJournalDB(t)
	h := &Handler{DB: db}
	owner := makeUser(t, db)
	intruder := makeUser(t, db)
	tmplID := seedTemplate(t, db, models.JSONB{"sections": []interface{}{}})

	item := createItem(t, h, owner, tmplID, "private")

	// Intruder PATCH -> 404, content unchanged.
	c, w := ctxFor(http.MethodPatch, `{"title":"hacked"}`, intruder,
		gin.Params{{Key: "id", Value: item.ID.String()}})
	h.UpdateJournalItem(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("intruder patch status = %d, want 404", w.Code)
	}

	// Intruder DELETE -> 404, item survives.
	c, w = ctxFor(http.MethodDelete, "", intruder,
		gin.Params{{Key: "id", Value: item.ID.String()}})
	h.DeleteJournalItem(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("intruder delete status = %d, want 404", w.Code)
	}
	var still models.JournalItem
	if err := db.First(&still, "id = ?", item.ID).Error; err != nil {
		t.Errorf("owner's item should still exist: %v", err)
	}
	if still.Title != "private" {
		t.Errorf("owner's item was mutated: title = %q", still.Title)
	}
}
