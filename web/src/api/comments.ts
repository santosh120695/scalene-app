import { api } from "./client";
import type { NoteComment } from "@/types";

export async function listComments(itemId: string): Promise<NoteComment[]> {
  const { data } = await api.get<{ comments: NoteComment[] }>(`/items/${itemId}/comments`);
  return data.comments;
}

export interface CreateCommentInput {
  anchorId: string;
  content: string;
  // Only stored on a thread's first comment; replies inherit it.
  quotedText?: string;
}

export async function createComment(
  itemId: string,
  input: CreateCommentInput
): Promise<NoteComment> {
  const { data } = await api.post<NoteComment>(`/items/${itemId}/comments`, input);
  return data;
}

export async function updateComment(id: string, content: string): Promise<NoteComment> {
  const { data } = await api.patch<NoteComment>(`/comments/${id}`, { content });
  return data;
}

export interface DeleteCommentResult {
  // True when the deleted comment anchored the thread, so the whole thread went
  // with it and the caller must strip the highlight from the note.
  threadDeleted: boolean;
  anchorId: string;
}

export async function deleteComment(id: string): Promise<DeleteCommentResult> {
  const { data } = await api.delete<DeleteCommentResult>(`/comments/${id}`);
  return data;
}

// Only a thread's first comment can be resolved.
export async function resolveComment(id: string, resolved: boolean): Promise<NoteComment> {
  const { data } = await api.patch<NoteComment>(`/comments/${id}/resolve`, { resolved });
  return data;
}
