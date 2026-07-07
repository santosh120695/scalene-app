import { api } from "./client";
import type { SearchResult } from "@/types";

export async function search(q: string, boardId?: string): Promise<SearchResult[]> {
  const { data } = await api.get<{ results: SearchResult[]; total: number }>("/search", {
    params: { q, boardId },
  });
  return data.results;
}
