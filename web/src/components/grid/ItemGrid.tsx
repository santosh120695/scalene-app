import { useState } from "react";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import type { AnyItem, Board } from "@/types";
import { GridItem } from "./GridItem";
import { BoardCard } from "./BoardCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyBoard } from "@/components/board/EmptyStates";

interface Props {
  items: AnyItem[];
  boards: Board[];
  loading: boolean;
  newItemId?: string | null;
  onOpen: (item: AnyItem) => void;
  onOpenBoard: (id: string) => void;
  onDeleteBoard: (board: Board) => void;
  onMoveBoard: (board: Board) => void;
  onEdit: (item: AnyItem) => void;
  onDelete: (id: string) => void;
  onTogglePin: (item: AnyItem) => void;
  onSetColor: (id: string, color: string) => void;
  onMoveToBoard: (item: AnyItem) => void;
  onReorder: (ids: string[]) => void;
  onAddLink: () => void;
  onUpload: () => void;
  onAddNote: () => void;
}

export function ItemGrid({
  items,
  boards,
  loading,
  newItemId,
  onOpen,
  onOpenBoard,
  onDeleteBoard,
  onMoveBoard,
  onEdit,
  onDelete,
  onTogglePin,
  onSetColor,
  onMoveToBoard,
  onReorder,
  onAddLink,
  onUpload,
  onAddNote,
}: Props) {
  const [order, setOrder] = useState<AnyItem[] | null>(null);

  // Use local order during drag for snappy feedback, fall back to props.
  const rendered = order ?? items;

  if (loading) {
    return (
      <div className="grid-area">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-7 px-6 py-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[240px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0 && boards.length === 0) {
    return (
      <EmptyBoard
        onAddLink={onAddLink}
        onUpload={onUpload}
        onAddNote={onAddNote}
      />
    );
  }

  // Pinned items first, then sub-board cards, then the rest of the items.
  const pinned = rendered.filter((i) => i.isPinned);
  const unpinned = rendered.filter((i) => !i.isPinned);

  // The sortable set in DOM order (board cards are static, not sortable).
  // Each item's `index` must match this ordering for dnd-kit's sorting.
  const sortable = [...pinned, ...unpinned];
  const indexOf = new Map(sortable.map((item, i) => [item.id, i]));

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) {
      setOrder(null);
      return;
    }
    const next = move(sortable, event);
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  const renderItem = (item: AnyItem) => (
    <GridItem
      key={item.id}
      item={item}
      index={indexOf.get(item.id)!}
      isNew={item.id === newItemId}
      onOpen={() => onOpen(item)}
      onEdit={() => onEdit(item)}
      onDelete={() => onDelete(item.id)}
      onTogglePin={() => onTogglePin(item)}
      onSetColor={(c) => onSetColor(item.id, c)}
      onMoveToBoard={() => onMoveToBoard(item)}
    />
  );

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-7 px-6 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {pinned.map(renderItem)}
        {boards.map((b) => (
          <BoardCard
            key={b.id}
            board={b}
            onOpen={() => onOpenBoard(b.id)}
            onDelete={() => onDeleteBoard(b)}
            onMove={() => onMoveBoard(b)}
          />
        ))}
        {unpinned.map(renderItem)}
      </div>
    </DragDropProvider>
  );
}
