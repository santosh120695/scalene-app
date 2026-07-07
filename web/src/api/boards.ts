import { api } from "./client";
import type { Board, BoardState } from "@/types";

export async function listBoards(): Promise<Board[]> {
  const { data } = await api.get<{ boards: Board[] }>("/boards");
  return data.boards;
}

export async function getBoard(id: string): Promise<Board> {
  const { data } = await api.get<Board>(`/boards/${id}`);
  return data;
}

export async function createBoard(payload: {
  title?: string;
  description?: string;
  tags?: string[];
  parentId?: string | null;
}): Promise<Board> {
  const { data } = await api.post<Board>("/boards", payload);
  return data;
}

export async function updateBoard(
  id: string,
  payload: Partial<Pick<Board, "title" | "description" | "isPublic" | "tags" | "coverUrl">>
): Promise<Board> {
  const { data } = await api.put<Board>(`/boards/${id}`, payload);
  return data;
}

export async function moveBoard(id: string, parentId: string | null): Promise<Board> {
  const { data } = await api.patch<Board>(`/boards/${id}/parent`, { parentId });
  return data;
}

export async function deleteBoard(id: string): Promise<void> {
  await api.delete(`/boards/${id}`);
}

export async function saveBoardState(id: string, state: BoardState): Promise<void> {
  await api.put(`/boards/${id}/state`, state);
}

export async function reorderItems(boardId: string, itemIds: string[]): Promise<void> {
  await api.patch(`/boards/${boardId}/reorder`, { itemIds });
}
