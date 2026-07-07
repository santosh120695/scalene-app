import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Use local order during drag for snappy feedback, fall back to props.
  const rendered = order ?? items;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setOrder(null);
      return;
    }
    const oldIndex = rendered.findIndex((i) => i.id === active.id);
    const newIndex = rendered.findIndex((i) => i.id === over.id);
    const next = arrayMove(rendered, oldIndex, newIndex);
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  if (loading) {
    return (
      <div className="grid-area">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-7 px-6 py-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

  const renderItem = (item: AnyItem) => (
    <GridItem
      key={item.id}
      item={item}
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setOrder(null)}
    >
      <SortableContext items={rendered.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-7 px-6 py-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </SortableContext>
    </DndContext>
  );
}
