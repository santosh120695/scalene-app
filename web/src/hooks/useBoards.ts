import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as boardsApi from "@/api/boards";
import type { Board } from "@/types";

export const boardKeys = {
  list: ["boards"] as const,
  detail: (id: string) => ["board", id] as const,
};

export function useBoardsList() {
  return useQuery({ queryKey: boardKeys.list, queryFn: boardsApi.listBoards });
}

export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: boardKeys.detail(id ?? ""),
    queryFn: () => boardsApi.getBoard(id!),
    enabled: !!id,
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: boardsApi.createBoard,
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.list }),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; payload: Partial<Board> }) =>
      boardsApi.updateBoard(vars.id, vars.payload),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: boardKeys.list });
      qc.invalidateQueries({ queryKey: boardKeys.detail(board.id) });
    },
  });
}

export function useMoveBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; parentId: string | null }) =>
      boardsApi.moveBoard(vars.id, vars.parentId),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: boardKeys.list });
      qc.invalidateQueries({ queryKey: boardKeys.detail(board.id) });
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: boardsApi.deleteBoard,
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.list }),
  });
}
