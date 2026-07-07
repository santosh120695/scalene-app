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
  itemType: ItemType;
  sortOrder: number;
  colorLabel?: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface NoteItem extends CanvasItemBase {
  itemType: "note";
  title?: string;
  content?: string;
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

export interface SubNote {
  id: string;
  itemId: string;
  userId: string;
  content: string;
  highlight?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  itemId: string;
  boardId: string;
  boardTitle: string;
  cardType: ItemType;
  title: string;
  snippet: string;
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
