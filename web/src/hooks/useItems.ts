import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as itemsApi from "@/api/items";
import * as boardsApi from "@/api/boards";
import { boardKeys } from "./useBoards";

// Mutations that change a board's items all invalidate that board's detail query.
function useBoardInvalidation(boardId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    qc.invalidateQueries({ queryKey: boardKeys.list });
  };
}

export function useCreateNote(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (payload: { title?: string; content?: string }) =>
      itemsApi.createNote({ boardId, ...payload }),
    onSuccess: invalidate,
  });
}

export function useCreateLink(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (url: string) => itemsApi.createLink({ boardId, url }),
    onSuccess: invalidate,
  });
}

export function useUploadPdf(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (file: File) => itemsApi.uploadPdf(boardId, file),
    onSuccess: invalidate,
  });
}

export function useUploadImage(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (vars: { file: File; caption?: string }) =>
      itemsApi.uploadImage(boardId, vars.file, vars.caption),
    onSuccess: invalidate,
  });
}

export function useDeleteItem(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: itemsApi.deleteItem,
    onSuccess: invalidate,
  });
}

export function usePinItem(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (vars: { id: string; isPinned: boolean }) =>
      itemsApi.pinItem(vars.id, vars.isPinned),
    onSuccess: invalidate,
  });
}

export function useColorItem(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (vars: { id: string; colorLabel: string }) =>
      itemsApi.colorItem(vars.id, vars.colorLabel),
    onSuccess: invalidate,
  });
}

export function useReorderItems(boardId: string) {
  const invalidate = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (itemIds: string[]) => boardsApi.reorderItems(boardId, itemIds),
    onSuccess: invalidate,
  });
}

export function useMoveItem(boardId: string) {
  const qc = useQueryClient();
  const invalidateSource = useBoardInvalidation(boardId);
  return useMutation({
    mutationFn: (vars: { id: string; boardId: string }) =>
      itemsApi.moveItem(vars.id, vars.boardId),
    onSuccess: (data, vars) => {
      invalidateSource();
      qc.invalidateQueries({ queryKey: boardKeys.detail(vars.boardId) });
      // Moving un-nests a sub-note, so its former parent's list is now stale.
      if (data?.unnestedFrom) {
        qc.invalidateQueries({ queryKey: ["item", data.unnestedFrom] });
      }
    },
  });
}
