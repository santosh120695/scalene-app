package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	FullName     string    `gorm:"type:varchar(255)" json:"fullName"`
	AvatarURL    string    `gorm:"type:text" json:"avatarUrl,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Board struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;index;not null" json:"userId"`
	ParentID    *uuid.UUID     `gorm:"type:uuid;index" json:"parentId,omitempty"`
	Title       string         `gorm:"type:varchar(255);not null;default:'Untitled Board'" json:"title"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	CoverURL    string         `gorm:"type:text" json:"coverUrl,omitempty"`
	IsPublic    bool           `gorm:"default:false" json:"isPublic"`
	BoardState  JSONB          `gorm:"type:jsonb;default:'{}'" json:"boardState"`
	Tags        StringArray    `gorm:"type:text[];default:'{}'" json:"tags"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type CanvasItem struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BoardID uuid.UUID `gorm:"type:uuid;index;not null" json:"boardId"`
	UserID  uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	// Set when this item is a sub-note nested inside another note. A child
	// always shares its parent's board — see CreateNote. Mirrors Board.ParentID.
	ParentItemID *uuid.UUID     `gorm:"type:uuid;index" json:"parentItemId,omitempty"`
	ItemType     string         `gorm:"type:varchar(50);index;not null" json:"itemType"` // pdf | link | note | image | excalidraw
	SortOrder    int            `gorm:"not null;default:0" json:"sortOrder"`
	ColorLabel   string         `gorm:"type:varchar(50)" json:"colorLabel,omitempty"`
	IsPinned     bool           `gorm:"default:false" json:"isPinned"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type PdfItem struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title        string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	FilePath     string    `gorm:"type:text;not null" json:"filePath"`
	FileSize     int64     `gorm:"not null" json:"fileSize"`
	PageCount    int       `json:"pageCount,omitempty"`
	ThumbnailURL string    `gorm:"type:text" json:"thumbnailUrl,omitempty"`
}

type LinkItem struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	URL          string    `gorm:"type:text;not null" json:"url"`
	Title        string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	Description  string    `gorm:"type:text" json:"description,omitempty"`
	ThumbnailURL string    `gorm:"type:text" json:"thumbnailUrl,omitempty"`
	Domain       string    `gorm:"type:varchar(255)" json:"domain,omitempty"`
	Content      string    `gorm:"type:text" json:"content,omitempty"`
	Byline       string    `gorm:"type:varchar(255)" json:"byline,omitempty"`
}

type NoteItem struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title   string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	Content string    `gorm:"type:text" json:"content,omitempty"`
}

type ExcalidrawItem struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title     string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	SceneData JSONB     `gorm:"type:jsonb;default:'{}'" json:"sceneData"`
	Thumbnail string    `gorm:"type:text" json:"thumbnail,omitempty"`
}

type ImageItem struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Caption      string    `gorm:"type:varchar(500)" json:"caption,omitempty"`
	FilePath     string    `gorm:"type:text;not null" json:"filePath"`
	FileSize     int64     `gorm:"not null" json:"fileSize"`
	MimeType     string    `gorm:"type:varchar(100)" json:"mimeType,omitempty"`
	WidthPx      int       `json:"widthPx,omitempty"`
	HeightPx     int       `json:"heightPx,omitempty"`
	ThumbnailURL string    `gorm:"type:text" json:"thumbnailUrl,omitempty"`
}

type EditorImage struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	FilePath  string    `gorm:"type:text;not null" json:"filePath"`
	MimeType  string    `gorm:"type:varchar(100)" json:"mimeType,omitempty"`
	FileSize  int64     `gorm:"not null;default:0" json:"fileSize"`
	CreatedAt time.Time `json:"createdAt"`
}

type Todo struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ItemID      uuid.NullUUID  `gorm:"type:uuid;index" json:"itemId"`
	BoardID     uuid.NullUUID  `gorm:"type:uuid;index" json:"boardId"`
	UserID      uuid.UUID      `gorm:"type:uuid;index;not null" json:"userId"`
	Text        string         `gorm:"type:text;not null;default:''" json:"text"`
	IsCompleted bool           `gorm:"not null;default:false" json:"isCompleted"`
	Position    int            `gorm:"not null;default:0" json:"position"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// Comment is a remark anchored to a highlighted passage of a note. AnchorID is
// minted by the editor and mirrored into the note HTML as
// <mark data-comment-id="…">; every comment sharing an anchor is one flat
// thread, whose first row (IsThreadRoot) owns QuotedText and the resolve state.
type Comment struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ItemID       uuid.UUID      `gorm:"type:uuid;index;not null" json:"itemId"`
	AnchorID     uuid.UUID      `gorm:"type:uuid;index;not null" json:"anchorId"`
	IsThreadRoot bool           `gorm:"not null;default:false" json:"isThreadRoot"`
	QuotedText   string         `gorm:"type:text;not null;default:''" json:"quotedText"`
	UserID       uuid.UUID      `gorm:"type:uuid;index;not null" json:"userId"`
	Content      string         `gorm:"type:text;not null" json:"content"`
	ResolvedAt   *time.Time     `json:"resolvedAt"`
	ResolvedBy   *uuid.UUID     `gorm:"type:uuid" json:"resolvedBy"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type JournalDay struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID      `gorm:"type:uuid;index;not null" json:"userId"`
	Date       time.Time      `gorm:"type:date;not null" json:"date"`
	ItemCount  int            `gorm:"not null;default:0" json:"itemCount"`
	TotalWords int            `gorm:"not null;default:0" json:"totalWords"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type JournalItem struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	JournalDayID uuid.UUID      `gorm:"type:uuid;index;not null" json:"journalDayId"`
	UserID       uuid.UUID      `gorm:"type:uuid;index;not null" json:"userId"`
	Title        string         `gorm:"type:varchar(500);not null;default:''" json:"title"`
	Content      string         `gorm:"type:text;not null;default:''" json:"content"`
	StyleConfig  JSONB          `gorm:"type:jsonb;not null;default:'{}'" json:"styleConfig"`
	Tags         StringArray    `gorm:"type:text[];not null;default:'{}'" json:"tags"`
	SortOrder    int            `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	JournalDay   JournalDay     `json:"journalDay"`
}

type JournalTemplate struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	Template  JSONB     `gorm:"type:jsonb;not null;default:'{}'" json:"template"`
	IsSystem  bool      `gorm:"not null;default:false" json:"isSystem"`
	SortOrder int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type JournalPreference struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID           uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"userId"`
	PreferenceConfig JSONB     `gorm:"type:jsonb;not null;default:'{}'" json:"preferenceConfig"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func (User) TableName() string           { return "users" }
func (Board) TableName() string          { return "boards" }
func (CanvasItem) TableName() string     { return "canvas_items" }
func (PdfItem) TableName() string        { return "pdf_items" }
func (LinkItem) TableName() string       { return "link_items" }
func (NoteItem) TableName() string       { return "note_items" }
func (ImageItem) TableName() string      { return "image_items" }
func (ExcalidrawItem) TableName() string { return "excalidraw_items" }
func (Comment) TableName() string        { return "comments" }
func (Todo) TableName() string           { return "todos" }
func (EditorImage) TableName() string    { return "editor_images" }

func (JournalDay) TableName() string        { return "journal_days" }
func (JournalItem) TableName() string       { return "journal_items" }
func (JournalTemplate) TableName() string   { return "journal_templates" }
func (JournalPreference) TableName() string { return "journal_preferences" }
