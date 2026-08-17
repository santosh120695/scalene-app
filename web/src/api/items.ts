import { api, API_BASE } from "./client";
import type { AnyItem } from "@/types";

export async function getItem(id: string): Promise<AnyItem> {
  const { data } = await api.get<AnyItem & { success?: boolean }>(`/items/${id}`);
  return data;
}

export async function createNote(payload: {
  boardId: string;
  // Makes the new note a sub-note nested inside this one. The server derives
  // the board from the parent, so boardId is advisory when this is set.
  parentItemId?: string;
  title?: string;
  content?: string;
}): Promise<AnyItem> {
  const { data } = await api.post<AnyItem>("/notes", payload);
  return data;
}

export async function updateNote(
  id: string,
  payload: { title?: string; content?: string }
): Promise<AnyItem> {
  const { data } = await api.put<AnyItem>(`/notes/${id}`, payload);
  return data;
}

export async function createLink(payload: {
  boardId: string;
  url: string;
}): Promise<AnyItem> {
  const { data } = await api.post<AnyItem>("/links", payload);
  return data;
}

export async function updateLink(
  id: string,
  payload: { title?: string; description?: string }
): Promise<AnyItem> {
  const { data } = await api.put<AnyItem>(`/links/${id}`, payload);
  return data;
}

export async function uploadPdf(boardId: string, file: File): Promise<AnyItem> {
  const form = new FormData();
  form.append("boardId", boardId);
  form.append("file", file);
  const { data } = await api.post<AnyItem>("/pdfs", form);
  return data;
}

export async function uploadImage(
  boardId: string,
  file: File,
  caption = ""
): Promise<AnyItem> {
  const form = new FormData();
  form.append("boardId", boardId);
  form.append("caption", caption);
  form.append("file", file);
  const { data } = await api.post<AnyItem>("/images", form);
  return data;
}

export async function updateImageCaption(id: string, caption: string): Promise<AnyItem> {
  const { data } = await api.put<AnyItem>(`/images/${id}`, { caption });
  return data;
}

// Uploads an image to embed inline in TipTap note content. Returns a stable URL
// (backed by the /editor/images/:id redirect route) that never expires, unlike
// the presigned URLs used for first-class image cards.
export async function uploadEditorImage(
  file: File
): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ id: string }>("/editor/images", form);
  // Build the absolute src against the same API origin the app already uses;
  // the serve route redirects it to a freshly presigned object URL.
  return { id: data.id, url: `${API_BASE}/editor/images/${data.id}` };
}

export async function createExcalidraw(payload: {
  boardId: string;
  title?: string;
}): Promise<AnyItem> {
  const { data } = await api.post<AnyItem>("/excalidraws", payload);
  return data;
}

export async function updateExcalidraw(
  id: string,
  payload: { title?: string; sceneData?: object; thumbnail?: string }
): Promise<AnyItem> {
  const { data } = await api.put<AnyItem>(`/excalidraws/${id}`, payload);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete(`/items/${id}`);
}

export async function pinItem(id: string, isPinned: boolean): Promise<void> {
  await api.patch(`/items/${id}/pin`, { isPinned });
}

export async function colorItem(id: string, colorLabel: string): Promise<void> {
  await api.patch(`/items/${id}/color`, { colorLabel });
}

export interface MoveItemResult {
  boardId: string;
  // Set when the item was a sub-note: moving un-nests it, so the note it came
  // out of needs refreshing.
  unnestedFrom?: string | null;
}

export async function moveItem(id: string, boardId: string): Promise<MoveItemResult> {
  const { data } = await api.patch<MoveItemResult>(`/items/${id}/board`, { boardId });
  return data;
}
