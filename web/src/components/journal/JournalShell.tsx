import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { useBoardsList, useDeleteBoard, useMoveBoard } from "@/hooks/useBoards";
import { AppShell } from "@/components/layout/AppShell";
import { NewBoardDialog } from "@/components/board/NewBoardDialog";
import { MoveBoardDialog } from "@/components/board/MoveBoardDialog";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import type { Board } from "@/types";

// Shared page frame for the journal routes — wires the sidebar/board actions
// exactly like the other top-level pages so the journal reuses the same nav.
export function JournalShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const boardsQuery = useBoardsList();
  const boards = boardsQuery.data ?? [];
  const deleteBoard = useDeleteBoard();
  const moveBoard = useMoveBoard();

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
    const { id } = moveBoardTarget;
    moveBoard.mutate(
      { id, parentId: newParentId },
      {
        onSuccess: () => {
          toast.success("Board moved");
          setMoveBoardTarget(null);
        },
        onError: (e) => toast.error(errMessage(e, "Could not move board")),
      },
    );
  }

  return (
    <>
      <AppShell
        boards={boards}
        user={user}
        mobileTitle="Journal"
        activeJournal
        onSelectBoard={(id) => navigate(`/b/${id}`)}
        onOpenTodos={() => navigate("/todos")}
        onOpenJournal={() => {}}
        onNewBoard={() => setNewBoardOpen(true)}
        onDeleteBoard={handleDeleteBoard}
        onMoveBoard={(board) => setMoveBoardTarget(board)}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      >
        {children}
      </AppShell>

      <NewBoardDialog
        open={newBoardOpen}
        onOpenChange={setNewBoardOpen}
        onCreated={(id) => navigate(`/b/${id}`)}
      />
      <MoveBoardDialog
        board={moveBoardTarget}
        boards={boards}
        open={moveBoardTarget !== null}
        onOpenChange={(open) => !open && setMoveBoardTarget(null)}
        onSelect={handleMoveBoard}
      />
    </>
  );
}
