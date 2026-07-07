import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { AnyItem, Board } from "@/types";
import { useAuth } from "@/stores/auth";
import {
  useBoardsList,
  useBoard,
  useDeleteBoard,
  useMoveBoard,
  boardKeys,
} from "@/hooks/useBoards";
import {
  useColorItem,
  useDeleteItem,
  useMoveItem,
  usePinItem,
  useReorderItems,
} from "@/hooks/useItems";
import * as itemsApi from "@/api/items";
import { errMessage } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { AddItemFab } from "@/components/board/AddItemFab";
import { ItemGrid } from "@/components/grid/ItemGrid";
import { ItemDetailView } from "@/components/detail/ItemDetailView";
import { ResizableSplit } from "@/components/detail/ResizableSplit";
import { SplitBrowser } from "@/components/detail/SplitBrowser";
import { NewBoardDialog } from "@/components/board/NewBoardDialog";
import { MoveToBoardDialog } from "@/components/board/MoveToBoardDialog";
import { MoveBoardDialog } from "@/components/board/MoveBoardDialog";
import { RenameBoardDialog } from "@/components/board/RenameBoardDialog";
import { LinkDialog } from "@/components/board/LinkDialog";
import { UploadDialog } from "@/components/board/UploadDialog";
import {
  EmptyBoardsList,
  CenteredMessage,
} from "@/components/board/EmptyStates";
import { toast } from "@/components/ui/sonner";

export function AppPage() {
  const navigate = useNavigate();
  const { boardId, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const splitId = searchParams.get("split");
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const qc = useQueryClient();
  const boardsQuery = useBoardsList();
  const boards = boardsQuery.data ?? [];

  // Refresh the current board and the sidebar counts after an item changes.
  function refreshAfterItemChange() {
    boardQuery.refetch();
    qc.invalidateQueries({ queryKey: boardKeys.list });
  }

  // Auto-select the first board when none is in the URL.
  useEffect(() => {
    if (!boardId && boards.length > 0) {
      navigate(`/b/${boards[0].id}`, { replace: true });
    }
  }, [boardId, boards, navigate]);

  const boardQuery = useBoard(boardId);
  const board = boardQuery.data;

  // ── Derived item list — pinned items first, then by sort order ──
  const items = useMemo(() => {
    const list = [...(board?.items ?? [])];
    list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    return list;
  }, [board?.items]);

  // Sub-boards of the current board (shown as cards in the grid).
  const childBoards = useMemo(
    () =>
      boards
        .filter((b) => b.parentId === boardId)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [boards, boardId],
  );

  // Breadcrumb chain: root → … → current board.
  const breadcrumbs = useMemo(() => {
    if (!boardId) return [];
    const byId = new Map(boards.map((b) => [b.id, b]));
    const chain = [];
    let cur = byId.get(boardId);
    while (cur) {
      chain.unshift({ id: cur.id, title: cur.title });
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain;
  }, [boards, boardId]);

  // ── Mutations ──
  const del = useDeleteItem(boardId ?? "");
  const pin = usePinItem(boardId ?? "");
  const color = useColorItem(boardId ?? "");
  const reorder = useReorderItems(boardId ?? "");
  const move = useMoveItem(boardId ?? "");
  const deleteBoard = useDeleteBoard();
  const moveBoard = useMoveBoard();

  // ── Dialog state ──
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardParent, setNewBoardParent] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Board | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingExcalidraw, setCreatingExcalidraw] = useState(false);
  // When set, a newly-created item opens in a split beside this item.
  const [splitWith, setSplitWith] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<AnyItem | null>(null);
  const [moveBoardTarget, setMoveBoardTarget] = useState<Board | null>(null);

  function flashNew(id: string) {
    setNewItemId(id);
    setTimeout(() => setNewItemId((cur) => (cur === id ? null : cur)), 600);
  }

  // Create an empty note and jump straight into its full-page editor.
  async function handleNewNote() {
    if (!boardId || creatingNote) return;
    setCreatingNote(true);
    try {
      const created = await itemsApi.createNote({
        boardId,
        title: "",
        content: "",
      });
      qc.invalidateQueries({ queryKey: boardKeys.list });
      boardQuery.refetch();
      navigate(`/b/${boardId}/item/${created.id}`);
    } catch (e) {
      toast.error(errMessage(e, "Could not create note"));
    } finally {
      setCreatingNote(false);
    }
  }

  // Create an empty drawing and jump straight into its full-page editor.
  async function handleNewExcalidraw() {
    if (!boardId || creatingExcalidraw) return;
    setCreatingExcalidraw(true);
    try {
      const created = await itemsApi.createExcalidraw({ boardId, title: "" });
      qc.invalidateQueries({ queryKey: boardKeys.list });
      boardQuery.refetch();
      navigate(`/b/${boardId}/item/${created.id}`);
    } catch (e) {
      toast.error(errMessage(e, "Could not create drawing"));
    } finally {
      setCreatingExcalidraw(false);
    }
  }

  // ── Keyboard shortcuts (PRD §4.2) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "n") {
        e.preventDefault();
        handleNewNote();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Every item opens in the full-page view (sidebar stays visible).
  function handleOpen(item: AnyItem) {
    navigate(`/b/${item.boardId}/item/${item.id}`);
  }

  function handleMoveItem(targetBoardId: string) {
    if (!moveTarget) return;
    const { id, boardId: originBoardId } = moveTarget;
    move.mutate(
      { id, boardId: targetBoardId },
      {
        onSuccess: () => {
          toast.success("Moved to board", {
            action: {
              label: "Undo",
              onClick: () => move.mutate({ id, boardId: originBoardId }),
            },
          });
          setMoveTarget(null);
        },
        onError: (e) => toast.error(errMessage(e, "Could not move item")),
      },
    );
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

  // Create a new item and open it in the split, beside `currentItemId`.
  async function createSplitItem(
    type: "note" | "link" | "upload",
    currentItemId: string,
  ) {
    if (!boardId) return;
    if (type === "note") {
      try {
        const created = await itemsApi.createNote({
          boardId,
          title: "",
          content: "",
        });
        qc.invalidateQueries({ queryKey: boardKeys.list });
        navigate(`/b/${boardId}/item/${currentItemId}?split=${created.id}`);
      } catch (e) {
        toast.error(errMessage(e, "Could not create note"));
      }
    } else {
      // Link / upload need their input dialogs; remember the split target.
      setSplitWith(currentItemId);
      if (type === "link") setLinkOpen(true);
      else setUploadOpen(true);
    }
  }

  // After a link/upload is created: open it in a split if one is pending.
  function handleItemCreated(id: string) {
    if (splitWith) {
      const target = splitWith;
      setSplitWith(null);
      navigate(`/b/${boardId}/item/${target}?split=${id}`);
    } else {
      refreshAfterItemChange();
      flashNew(id);
    }
  }

  // ── Board tree handlers ──
  function openNewBoard() {
    setNewBoardParent(null);
    setNewBoardOpen(true);
  }
  function openNewSubBoard(parentId: string) {
    setNewBoardParent(parentId);
    setNewBoardOpen(true);
  }
  // Collect a board and all its descendants (so deleting can detect open boards).
  function descendantIds(rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const b of boards) {
        if (b.parentId && ids.has(b.parentId) && !ids.has(b.id)) {
          ids.add(b.id);
          added = true;
        }
      }
    }
    return ids;
  }
  function handleDeleteBoard(board: Board) {
    const subtree = descendantIds(board.id);
    const childCount = subtree.size - 1;
    const msg =
      childCount > 0
        ? `Delete “${board.title}” and its ${childCount} sub-board${childCount > 1 ? "s" : ""}? This cannot be undone.`
        : `Delete “${board.title}”? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    deleteBoard.mutate(board.id, {
      onSuccess: () => {
        toast.success("Board deleted");
        // If the open board was inside the deleted subtree, leave it.
        if (boardId && subtree.has(boardId)) navigate("/");
      },
      onError: (e) => toast.error(errMessage(e, "Could not delete board")),
    });
  }

  const parentTitle = newBoardParent
    ? boards.find((b) => b.id === newBoardParent)?.title
    : undefined;

  const noBoards = boardsQuery.isSuccess && boards.length === 0;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <AppShell
        boards={boards}
        user={user}
        mobileTitle="Scalene"
        activeBoardId={boardId}
        onSelectBoard={(id) => navigate(`/b/${id}`)}
        onOpenTodos={() => navigate("/todos")}
        onNewBoard={openNewBoard}
        onDeleteBoard={handleDeleteBoard}
        onMoveBoard={(board) => setMoveBoardTarget(board)}
        onLogout={handleLogout}
      >
        <div className="contents">
          {itemId && boardId ? (
            <ResizableSplit
              left={
                <ItemDetailView
                  key={itemId}
                  itemId={itemId}
                  boardId={boardId}
                  onClosePane={
                    splitId
                      ? () =>
                          navigate(
                            splitId === "browse"
                              ? `/b/${boardId}`
                              : `/b/${boardId}/item/${splitId}`,
                          )
                      : undefined
                  }
                />
              }
              right={
                splitId === "browse" ? (
                  <SplitBrowser
                    boardId={boardId}
                    boards={boards}
                    onSelect={(id) =>
                      navigate(`/b/${boardId}/item/${itemId}?split=${id}`)
                    }
                    onClose={() => navigate(`/b/${boardId}/item/${itemId}`)}
                    onCreateNew={(type) => createSplitItem(type, itemId)}
                  />
                ) : splitId ? (
                  <ItemDetailView
                    key={splitId}
                    itemId={splitId}
                    boardId={boardId}
                    onClosePane={() => navigate(`/b/${boardId}/item/${itemId}`)}
                  />
                ) : null
              }
            />
          ) : noBoards ? (
            <EmptyBoardsList onCreate={() => setNewBoardOpen(true)} />
          ) : !boardId || !board ? (
            <CenteredMessage
              title="Select a board"
              body="Or create a new one to get started."
            />
          ) : (
            <div>
              <BoardToolbar
                itemCount={items.length}
                breadcrumbs={breadcrumbs}
                onNavigate={(id) => navigate(`/b/${id}`)}
                onRename={() => setRenameTarget(board)}
              />
              <ItemGrid
                items={items}
                boards={childBoards}
                loading={boardQuery.isLoading}
                newItemId={newItemId}
                onOpen={handleOpen}
                onOpenBoard={(id) => navigate(`/b/${id}`)}
                onDeleteBoard={handleDeleteBoard}
                onMoveBoard={(b) => setMoveBoardTarget(b)}
                onEdit={handleOpen}
                onDelete={(id) =>
                  del.mutate(id, {
                    onSuccess: () => toast.success("Item deleted"),
                  })
                }
                onTogglePin={(item) =>
                  pin.mutate({ id: item.id, isPinned: !item.isPinned })
                }
                onSetColor={(id, c) => color.mutate({ id, colorLabel: c })}
                onMoveToBoard={(item) => setMoveTarget(item)}
                onReorder={(ids) => reorder.mutate(ids)}
                onAddLink={() => {
                  setSplitWith(null);
                  setLinkOpen(true);
                }}
                onUpload={() => {
                  setSplitWith(null);
                  setUploadOpen(true);
                }}
                onAddNote={handleNewNote}
              />
            </div>
          )}
        </div>
      </AppShell>

      {/* Dialogs */}
      <NewBoardDialog
        open={newBoardOpen}
        onOpenChange={setNewBoardOpen}
        parentId={newBoardParent}
        parentTitle={parentTitle}
        onCreated={(id) => navigate(`/b/${id}`)}
      />
      <RenameBoardDialog
        board={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      />
      <MoveToBoardDialog
        item={moveTarget}
        boards={boards}
        open={!!moveTarget}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        onSelect={handleMoveItem}
      />
      <MoveBoardDialog
        board={moveBoardTarget}
        boards={boards}
        open={!!moveBoardTarget}
        onOpenChange={(open) => !open && setMoveBoardTarget(null)}
        onSelect={handleMoveBoard}
      />
      {boardId && (
        <>
          <LinkDialog
            open={linkOpen}
            onOpenChange={(o) => {
              setLinkOpen(o);
              if (!o) setSplitWith(null);
            }}
            boardId={boardId}
            onSaved={handleItemCreated}
          />
          <UploadDialog
            open={uploadOpen}
            onOpenChange={(o) => {
              setUploadOpen(o);
              if (!o) setSplitWith(null);
            }}
            boardId={boardId}
            onSaved={handleItemCreated}
          />
        </>
      )}

      {/* Quick-add floating button (board grid view only) */}
      {boardId && !itemId && (
        <AddItemFab
          onAddNote={handleNewNote}
          onAddLink={() => {
            setSplitWith(null);
            setLinkOpen(true);
          }}
          onUpload={() => {
            setSplitWith(null);
            setUploadOpen(true);
          }}
          onAddExcalidraw={handleNewExcalidraw}
          onNewSubBoard={() => openNewSubBoard(boardId)}
        />
      )}
    </>
  );
}
