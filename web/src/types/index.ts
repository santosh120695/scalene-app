// Domain types — mirror the PRD §3.2 definitions and the Go API responses.

export type ItemType = "pdf" | "link" | "note" | "image" | "excalidraw";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface BoardState {
  sortBy?: "recent" | "pinned";
  filterType?: ItemType | null;
}

export interface Board {
  id: string;
  userId: string;
  parentId?: string | null;
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  boardState: BoardState;
  tags: string[];
  itemCount?: number;
  items?: AnyItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CanvasItemBase {
  id: string;
  boardId: string;
  userId: string;
  // Set when this item is a sub-note nested inside another note. Items with a
  // parent are excluded from the board grid — they're reached via the parent.
  parentItemId?: string | null;
  itemType: ItemType;
  sortOrder: number;
  colorLabel?: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  // Only present on notes in a board listing.
  subNoteCount?: number;
}

export interface PdfItem extends CanvasItemBase {
  itemType: "pdf";
  title?: string;
  filePath: string;
  fileSize: number;
  pageCount?: number;
  thumbnailUrl?: string;
}

export interface LinkItem extends CanvasItemBase {
  itemType: "link";
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  domain?: string;
  content?: string; // readable article HTML (reader view)
  byline?: string;
}

// A note nested inside another, as listed on its parent's detail view.
export interface SubNoteRef {
  id: string;
  title: string;
  itemType: ItemType;
  updatedAt: string;
}

export interface NoteItem extends CanvasItemBase {
  itemType: "note";
  title?: string;
  content?: string;
  // Both only come from GET /items/:id, never from a board listing.
  subNotes?: SubNoteRef[];
  // Ancestors, root-most first, for the breadcrumb on a nested note.
  parentChain?: { id: string; title: string }[];
}

export interface ImageItem extends CanvasItemBase {
  itemType: "image";
  caption?: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  widthPx?: number;
  heightPx?: number;
  thumbnailUrl?: string;
}

export interface ExcalidrawItem extends CanvasItemBase {
  itemType: "excalidraw";
  title?: string;
  sceneData?: { elements: unknown[]; appState: Record<string, unknown> };
  thumbnail?: string; // base64 PNG data URL
}

export type AnyItem = PdfItem | LinkItem | NoteItem | ImageItem | ExcalidrawItem;

// A remark anchored to a highlighted passage of a note. anchorId is minted by
// the editor and mirrored into the note HTML as <mark data-comment-id="…">;
// every comment sharing an anchor is one flat thread, whose first comment
// (isThreadRoot) owns the quoted passage and the resolve state.
//
// Named NoteComment, not Comment: `Comment` is a lib.dom global, and an exported
// interface with that name silently shadows it in every importing file.
export interface NoteComment {
  id: string;
  itemId: string;
  anchorId: string;
  isThreadRoot: boolean;
  quotedText: string;
  userId: string;
  content: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

// Client-side grouping only — never returned by the API, because thread order
// comes from the note's document order, which only the editor knows.
export interface CommentThreadGroup {
  anchorId: string;
  quotedText: string;
  root: NoteComment;
  replies: NoteComment[];
  resolvedAt: string | null;
  // The anchor no longer appears in the note HTML (the highlighted text was
  // deleted), so this thread has nothing left to point at.
  detached: boolean;
}

export interface SearchResult {
  itemId: string;
  boardId: string;
  boardTitle: string;
  cardType: ItemType;
  title: string;
  snippet: string;
  // Set when the hit is a sub-note. Those are hidden from the board grid, so
  // search is a main route to them and the parent's name is the useful context.
  parentItemId?: string | null;
  parentTitle?: string;
}

// ---- Journal (daily entries) ----

export interface JournalTemplateSection {
  heading: string;
  placeholder?: string;
}

export interface JournalTemplate {
  id: string;
  name: string;
  template: { sections: JournalTemplateSection[] };
  sortOrder: number;
}

export type BackdropType = "color" | "image" | "upload";

export interface Backdrop {
  type: BackdropType;
  value: string; // palette hex for "color", image URL for "image"/"upload"
}

export interface JournalStyleConfig {
  backdrop?: Backdrop;
  fontKey?: string; // one of JOURNAL_FONTS keys
  templateId?: string; // originating template, for "set as default"
}

export interface JournalItem {
  id: string;
  journalDayId: string;
  userId: string;
  title: string;
  content: string; // Tiptap HTML
  styleConfig: JournalStyleConfig;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  date?: string; // the item's day (YYYY-MM-DD-ish), returned by the API
}

// A distinct tag with how many items carry it.
export interface JournalTagCount {
  tag: string;
  count: number;
}

// A day summary card shown on the journal home list.
export interface JournalDayCard {
  id: string;
  date: string; // YYYY-MM-DD
  itemCount: number;
  totalWords: number;
  latestItem: { id: string; title: string; contentPreview: string } | null;
}

// A full day with its items (the day view).
export interface JournalDay {
  id: string;
  date: string;
  itemCount: number;
  totalWords: number;
  items: JournalItem[];
}

export interface JournalPreferenceConfig {
  defaultTemplateId?: string;
  backdrop?: Backdrop;
  fontKey?: string;
}

export interface Todo {
  id: string;
  // Only set for todos synced from a note's checklist content; standalone
  // quick-added todos have no backing note/board.
  itemId: string | null;
  boardId: string | null;
  boardTitle: string;
  noteTitle: string;
  text: string;
  isCompleted: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}
