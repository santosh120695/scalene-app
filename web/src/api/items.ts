import { api } from "./client";
import type { AnyItem } from "@/types";

export async function getItem(id: string): Promise<AnyItem> {
  const { data } = await api.get<AnyItem & { success?: boolean }>(`/items/${id}`);
  return data;
}

export async function createNote(payload: {
  boardId: string;
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

export async function moveItem(id: string, boardId: string): Promise<void> {
  await api.patch(`/items/${id}/board`, { boardId });
}
