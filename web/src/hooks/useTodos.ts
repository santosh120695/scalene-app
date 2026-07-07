import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as todosApi from "@/api/todos";
import { boardKeys } from "@/hooks/useBoards";
import type { Todo } from "@/types";

// A todo synced from a note's checklist keeps that note's own cached query
// (and its board's item list) in sync too — otherwise the 30s query
// staleTime can serve back the pre-edit note content for a bit.
function invalidateBackingNote(qc: ReturnType<typeof useQueryClient>, todo: Todo) {
  if (todo.itemId) qc.invalidateQueries({ queryKey: ["item", todo.itemId] });
  if (todo.boardId) qc.invalidateQueries({ queryKey: boardKeys.detail(todo.boardId) });
}

export const todoKeys = {
  list: ["todos"] as const,
};

// Fetches every todo once; the Todos page filters Active/Completed client-side
// so a toggle only needs to patch one cached list, not several by-filter ones.
export function useTodosList() {
  return useQuery({ queryKey: todoKeys.list, queryFn: () => todosApi.listTodos() });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => todosApi.createTodo(text),
    onSuccess: (todo) => {
      // New todos are always active + newest, which is exactly where the
      // backend's own ordering (incomplete first, then most recent) puts
      // them — so prepending here matches what a refetch would return.
      qc.setQueryData<Todo[]>(todoKeys.list, (old) => (old ? [todo, ...old] : [todo]));
    },
  });
}

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { todo: Todo; isCompleted: boolean }) =>
      todosApi.toggleTodo(vars.todo.id, vars.isCompleted),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: todoKeys.list });
      const previous = qc.getQueryData<Todo[]>(todoKeys.list);
      qc.setQueryData<Todo[]>(todoKeys.list, (old) =>
        old?.map((t) => (t.id === vars.todo.id ? { ...t, isCompleted: vars.isCompleted } : t))
      );
      return { previous };
    },
    onSuccess: (_data, vars) => invalidateBackingNote(qc, vars.todo),
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(todoKeys.list, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.list }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (todo: Todo) => todosApi.deleteTodo(todo.id),
    onMutate: async (todo) => {
      await qc.cancelQueries({ queryKey: todoKeys.list });
      const previous = qc.getQueryData<Todo[]>(todoKeys.list);
      qc.setQueryData<Todo[]>(todoKeys.list, (old) => old?.filter((t) => t.id !== todo.id));
      return { previous };
    },
    onSuccess: (_data, todo) => invalidateBackingNote(qc, todo),
    onError: (_err, _todo, context) => {
      if (context?.previous) qc.setQueryData(todoKeys.list, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.list }),
  });
}
