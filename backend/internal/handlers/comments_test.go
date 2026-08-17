package handlers

import (
	"os"
	"testing"

	"knowledgecanvas/internal/database"
	"knowledgecanvas/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// setupCommentsDB mirrors setupJournalDB: DB-backed tests are skipped when
// TEST_DATABASE_URL is unset, so `go test ./...` stays green without Postgres.
func setupCommentsDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed comments test")
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

// seedNote creates a user, board and note item, and registers cleanup.
func seedNote(t *testing.T, db *gorm.DB) (userID, itemID uuid.UUID) {
	t.Helper()
	u := models.User{
		ID:           uuid.New(),
		Email:        "comments-" + uuid.NewString() + "@test.local",
		PasswordHash: "x",
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	b := models.Board{ID: uuid.New(), UserID: u.ID, Title: "Comments test"}
	if err := db.Create(&b).Error; err != nil {
		t.Fatalf("create board: %v", err)
	}
	ci := models.CanvasItem{ID: uuid.New(), BoardID: b.ID, UserID: u.ID, ItemType: "note"}
	if err := db.Create(&ci).Error; err != nil {
		t.Fatalf("create item: %v", err)
	}
	if err := db.Create(&models.NoteItem{ID: ci.ID, Title: "T", Content: "<p>hi</p>"}).Error; err != nil {
		t.Fatalf("create note: %v", err)
	}
	t.Cleanup(func() {
		db.Unscoped().Where("item_id = ?", ci.ID).Delete(&models.Comment{})
		db.Delete(&models.NoteItem{}, "id = ?", ci.ID)
		db.Unscoped().Delete(&models.CanvasItem{}, "id = ?", ci.ID)
		db.Unscoped().Delete(&models.Board{}, "id = ?", b.ID)
		db.Delete(&models.User{}, "id = ?", u.ID)
	})
	return u.ID, ci.ID
}

// The first comment on an anchor opens the thread; every later one is a reply,
// and only the root carries the quoted passage.
func TestInsertCommentRootThenReply(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, itemID := seedNote(t, db)
	anchor := uuid.New()

	root, err := h.insertComment(itemID, userID, createCommentReq{
		AnchorID: anchor, QuotedText: "the highlighted words", Content: "first",
	}, false)
	if err != nil {
		t.Fatalf("insert root: %v", err)
	}
	if !root.IsThreadRoot {
		t.Error("first comment on an anchor should be the thread root")
	}
	if root.QuotedText != "the highlighted words" {
		t.Errorf("root quotedText = %q, want the highlighted words", root.QuotedText)
	}

	reply, err := h.insertComment(itemID, userID, createCommentReq{
		AnchorID: anchor, QuotedText: "ignored", Content: "second",
	}, false)
	if err != nil {
		t.Fatalf("insert reply: %v", err)
	}
	if reply.IsThreadRoot {
		t.Error("second comment on an anchor should be a reply, not a second root")
	}
	if reply.QuotedText != "" {
		t.Errorf("reply quotedText = %q, want empty (replies inherit it)", reply.QuotedText)
	}
}

// uq_comments_thread_root_live is what stops a double-click forking one
// highlight into two threads; CreateComment's retry depends on it raising 23505.
func TestSecondRootOnSameAnchorIsRejected(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, itemID := seedNote(t, db)
	anchor := uuid.New()

	if _, err := h.insertComment(itemID, userID, createCommentReq{
		AnchorID: anchor, Content: "first",
	}, false); err != nil {
		t.Fatalf("insert root: %v", err)
	}

	// forceReply=false would see the existing root and insert a reply, so force
	// the root flag to simulate the concurrent-insert race directly.
	err := db.Create(&models.Comment{
		ItemID: itemID, AnchorID: anchor, IsThreadRoot: true,
		UserID: userID, Content: "racing root",
	}).Error
	if !isUniqueViolation(err) {
		t.Fatalf("second root: got %v, want a 23505 unique violation", err)
	}
}

// Deleting the anchoring comment strips the highlight, so the replies under it
// must go too rather than linger with nothing pointing at them.
func TestDeleteRootSoftDeletesWholeThread(t *testing.T) {
	db := setupCommentsDB(t)
	h := &Handler{DB: db}
	userID, itemID := seedNote(t, db)
	anchor := uuid.New()

	root, err := h.insertComment(itemID, userID, createCommentReq{AnchorID: anchor, Content: "root"}, false)
	if err != nil {
		t.Fatalf("insert root: %v", err)
	}
	if _, err := h.insertComment(itemID, userID, createCommentReq{AnchorID: anchor, Content: "reply"}, false); err != nil {
		t.Fatalf("insert reply: %v", err)
	}

	// The branch DeleteComment takes for a thread root.
	if err := db.Where("item_id = ? AND anchor_id = ?", root.ItemID, root.AnchorID).
		Delete(&models.Comment{}).Error; err != nil {
		t.Fatalf("delete thread: %v", err)
	}

	var live int64
	db.Model(&models.Comment{}).Where("item_id = ? AND anchor_id = ?", itemID, anchor).Count(&live)
	if live != 0 {
		t.Errorf("live comments after deleting the root = %d, want 0", live)
	}
	// Soft delete, not a hard one — the rows must still be recoverable.
	var total int64
	db.Unscoped().Model(&models.Comment{}).Where("item_id = ? AND anchor_id = ?", itemID, anchor).Count(&total)
	if total != 2 {
		t.Errorf("rows including soft-deleted = %d, want 2", total)
	}
}
