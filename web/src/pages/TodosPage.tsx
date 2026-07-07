import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { useBoardsList, useDeleteBoard, useMoveBoard } from "@/hooks/useBoards";
import { useCreateTodo, useDeleteTodo, useTodosList, useToggleTodo } from "@/hooks/useTodos";
import { AppShell } from "@/components/layout/AppShell";
import { NewBoardDialog } from "@/components/board/NewBoardDialog";
import { MoveBoardDialog } from "@/components/board/MoveBoardDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import { cn } from "@/lib/utils";
import type { Board, Todo } from "@/types";

type Tab = "active" | "completed";

export function TodosPage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const boardsQuery = useBoardsList();
  const boards = boardsQuery.data ?? [];
  const todosQuery = useTodosList();
  const toggle = useToggleTodo();
  const create = useCreateTodo();
  const deleteTodo = useDeleteTodo();
  const deleteBoard = useDeleteBoard();
  const moveBoard = useMoveBoard();

  const [tab, setTab] = useState<Tab>("active");
  const [newText, setNewText] = useState("");
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [moveBoardTarget, setMoveBoardTarget] = useState<Board | null>(null);

  function handleDeleteBoard(board: Board) {
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) return;
    deleteBoard.mutate(board.id, {
      onSuccess: () => toast.success("Board deleted"),
      onError: (e) => toast.error(errMessage(e, "Could not delete board")),
    });
  }

  function handleMoveBoard(newParentId: string | null) {
    if (!moveBoardTarget) return;
    const { id, parentId: originParentId } = moveBoardTarget;
    moveBoard.mutate(
      { id, parentId: newParentId },
      {
        onSuccess: () => {
          toast.success("Board moved", {
            action: {
              label: "Undo",
              onClick: () => moveBoard.mutate({ id, parentId: originParentId ?? null }),
            },
          });
          setMoveBoardTarget(null);
        },
        onError: (e) => toast.error(errMessage(e, "Could not move board")),
      },
    );
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const todos = todosQuery.data ?? [];
  const filtered = useMemo(
    () => todos.filter((t) => (tab === "active" ? !t.isCompleted : t.isCompleted)),
    [todos, tab]
  );
  const activeCount = useMemo(() => todos.filter((t) => !t.isCompleted).length, [todos]);
  const completedCount = todos.length - activeCount;

  function handleToggle(todo: Todo) {
    toggle.mutate(
      { todo, isCompleted: !todo.isCompleted },
      { onError: () => toast.error("Could not update todo") }
    );
  }

  function handleDelete(todo: Todo) {
    deleteTodo.mutate(todo, {
      onError: () => toast.error("Could not delete todo"),
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text || create.isPending) return;
    create.mutate(text, {
      onSuccess: () => setNewText(""),
      onError: () => toast.error("Could not add todo"),
    });
  }

  return (
    <>
      <AppShell
        boards={boards}
        user={user}
        mobileTitle="Todos"
        activeTodos
        onSelectBoard={(id) => navigate(`/b/${id}`)}
        onOpenTodos={() => {}}
        onNewBoard={() => setNewBoardOpen(true)}
        onDeleteBoard={handleDeleteBoard}
        onMoveBoard={(board) => setMoveBoardTarget(board)}
        onLogout={handleLogout}
      >
        <div className="mx-auto max-w-[760px] px-6 py-8">
            <h1 className="font-display text-[26px] italic text-ink-primary">
              Todos
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              Checklist items from every note, in one place.
            </p>

            <form
              onSubmit={handleCreate}
              className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Add a todo…"
                aria-label="Add a todo"
                className="sm:flex-1"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Add todo"
                title="Add todo"
                disabled={!newText.trim() || create.isPending}
                className="self-end sm:self-auto"
              >
                <Plus size={16} strokeWidth={1.5} />
              </Button>
            </form>

            <div className="mt-4 flex items-center gap-1 border-b border-[var(--border)]">
              {(["active", "completed"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-[13px] font-medium capitalize transition-colors",
                    tab === t
                      ? "border-brand text-brand"
                      : "border-transparent text-ink-secondary hover:text-ink-primary"
                  )}
                >
                  {t} ({t === "active" ? activeCount : completedCount})
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-1">
              {todosQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[52px] w-full" />
                ))
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-ink-muted">
                  {tab === "active"
                    ? "No open todos. Add a checklist to a note to see it here."
                    : "Nothing completed yet."}
                </p>
              ) : (
                filtered.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={() => handleToggle(todo)}
                    onDelete={() => handleDelete(todo)}
                    onOpen={
                      todo.boardId && todo.itemId
                        ? () => navigate(`/b/${todo.boardId}/item/${todo.itemId}`)
                        : undefined
                    }
                  />
                ))
              )}
            </div>
        </div>
      </AppShell>

      <NewBoardDialog
        open={newBoardOpen}
        onOpenChange={setNewBoardOpen}
        parentId={null}
        onCreated={(id) => navigate(`/b/${id}`)}
      />
      <MoveBoardDialog
        board={moveBoardTarget}
        boards={boards}
        open={!!moveBoardTarget}
        onOpenChange={(open) => !open && setMoveBoardTarget(null)}
        onSelect={handleMoveBoard}
      />
    </>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  onOpen,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const Wrapper = onOpen ? "button" : "div";
  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-sunken">
      <input
        type="checkbox"
        checked={todo.isCompleted}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
      />
      <Wrapper onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "text-[13px] text-ink-primary",
            todo.isCompleted && "text-ink-muted line-through"
          )}
        >
          {todo.text || "Untitled todo"}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">
          {todo.boardId ? `${todo.boardTitle} › ${todo.noteTitle || "Untitled note"}` : "Quick todo"}
        </p>
      </Wrapper>
      <button
        onClick={onDelete}
        aria-label="Delete todo"
        title="Delete todo"
        className="shrink-0 rounded-md p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
