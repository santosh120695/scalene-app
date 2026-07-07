import { api } from "./client";
import type { SubNote } from "@/types";

export async function listSubNotes(itemId: string): Promise<SubNote[]> {
  const { data } = await api.get<{ subNotes: SubNote[] }>(`/items/${itemId}/sub-notes`);
  return data.subNotes;
}

export async function createSubNote(
  itemId: string,
  content: string,
  highlight?: string
): Promise<SubNote> {
  const { data } = await api.post<SubNote>(`/items/${itemId}/sub-notes`, {
    content,
    highlight,
  });
  return data;
}

export async function deleteSubNote(id: string): Promise<void> {
  await api.delete(`/sub-notes/${id}`);
}
