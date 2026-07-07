package models

import (
	"time"

	"github.com/google/uuid"
)

// User — account holder.
type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	FullName     string    `gorm:"type:varchar(255)" json:"fullName"`
	AvatarURL    string    `gorm:"type:text" json:"avatarUrl,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Board — a Pinterest-style board owned by a user.
type Board struct {
	ID          uuid.UUID   `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID   `gorm:"type:uuid;index;not null" json:"userId"`
	ParentID    *uuid.UUID  `gorm:"type:uuid;index" json:"parentId,omitempty"`
	Title       string      `gorm:"type:varchar(255);not null;default:'Untitled Board'" json:"title"`
	Description string      `gorm:"type:text" json:"description,omitempty"`
	CoverURL    string      `gorm:"type:text" json:"coverUrl,omitempty"`
	IsPublic    bool        `gorm:"default:false" json:"isPublic"`
	BoardState  JSONB       `gorm:"type:jsonb;default:'{}'" json:"boardState"`
	Tags        StringArray `gorm:"type:text[];default:'{}'" json:"tags"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

// CanvasItem — shared grid metadata for all item types. Each concrete item type
// has its own child table that shares this primary key 1-to-1 via foreign key.
type CanvasItem struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BoardID    uuid.UUID `gorm:"type:uuid;index;not null" json:"boardId"`
	UserID     uuid.UUID `gorm:"type:uuid;index;not null" json:"userId"`
	ItemType   string    `gorm:"type:varchar(50);index;not null" json:"itemType"` // pdf | link | note | image | excalidraw
	SortOrder  int       `gorm:"not null;default:0" json:"sortOrder"`
	ColorLabel string    `gorm:"type:varchar(50)" json:"colorLabel,omitempty"`
	IsPinned   bool      `gorm:"default:false" json:"isPinned"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// PdfItem — shares PK with CanvasItem.
type PdfItem struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title        string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	FilePath     string    `gorm:"type:text;not null" json:"filePath"`
	FileSize     int64     `gorm:"not null" json:"fileSize"`
	PageCount    int       `json:"pageCount,omitempty"`
	ThumbnailURL string    `gorm:"type:text" json:"thumbnailUrl,omitempty"`
}

// LinkItem — shares PK with CanvasItem.
type LinkItem struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	URL          string    `gorm:"type:text;not null" json:"url"`
	Title        string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	Description  string    `gorm:"type:text" json:"description,omitempty"`
	ThumbnailURL string    `gorm:"type:text" json:"thumbnailUrl,omitempty"`
	Domain       string    `gorm:"type:varchar(255)" json:"domain,omitempty"`
	Content      string    `gorm:"type:text" json:"content,omitempty"` // readable article HTML
	Byline       string    `gorm:"type:varchar(255)" json:"byline,omitempty"`
}

// NoteItem — shares PK with CanvasItem.
type NoteItem struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title   string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	Content string    `gorm:"type:text" json:"content,omitempty"` // TipTap HTML
}

// ExcalidrawItem — shares PK with CanvasItem.
type ExcalidrawItem struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Title     string    `gorm:"type:varchar(500)" json:"title,omitempty"`
	SceneData JSONB     `gorm:"type:jsonb;default:'{}'" json:"sceneData"`
	Thumbnail string    `gorm:"type:text" json:"thumbnail,omitempty"`
}

// ImageItem — shares PK with CanvasItem.
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

// Todo — either a checklist item extracted from a note's TipTap content
// (kept in sync with the `data-todo-id`-tagged <li> it was parsed from, see
// handlers.syncTodosFromContent) or a standalone quick-added todo with no
// backing note/board. ItemID/BoardID are only set for the former.
type Todo struct {
	ID          uuid.UUID     `gorm:"type:uuid;primaryKey" json:"id"`
	ItemID      uuid.NullUUID `gorm:"type:uuid;index" json:"itemId"`
	BoardID     uuid.NullUUID `gorm:"type:uuid;index" json:"boardId"`
	UserID      uuid.UUID     `gorm:"type:uuid;index;not null" json:"userId"`
	Text        string        `gorm:"type:text;not null;default:''" json:"text"`
	IsCompleted bool          `gorm:"not null;default:false" json:"isCompleted"`
	Position    int           `gorm:"not null;default:0" json:"position"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// SubNote — an annotation attached to any canvas item.
type SubNote struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ItemID    uuid.UUID `gorm:"type:uuid;index;not null" json:"itemId"`
	UserID    uuid.UUID `gorm:"type:uuid;not null" json:"userId"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Highlight string    `gorm:"type:text" json:"highlight,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (User) TableName() string           { return "users" }
func (Board) TableName() string          { return "boards" }
func (CanvasItem) TableName() string     { return "canvas_items" }
func (PdfItem) TableName() string        { return "pdf_items" }
func (LinkItem) TableName() string       { return "link_items" }
func (NoteItem) TableName() string       { return "note_items" }
func (ImageItem) TableName() string      { return "image_items" }
func (ExcalidrawItem) TableName() string { return "excalidraw_items" }
func (SubNote) TableName() string        { return "sub_notes" }
func (Todo) TableName() string           { return "todos" }
