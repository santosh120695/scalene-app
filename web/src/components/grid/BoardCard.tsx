import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Folder, FolderInput, Trash2 } from "lucide-react";
import type { Board } from "@/types";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Props {
  board: Board;
  onOpen: () => void;
  onDelete: () => void;
  onMove: () => void;
}

// A sub-board shown as a card in the grid (like a folder). It is both:
//  - a drop target: dropping an item onto it moves the item into this board,
//    and dropping another board onto it re-parents that board under this one;
//  - a drag source: the whole card can be dragged onto another board.
export function BoardCard({ board, onOpen, onDelete, onMove }: Props) {
  const { ref: dragRef, isDragging } = useDraggable({
    id: board.id,
    type: "board",
  });
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: board.id,
    type: "board",
    accept: ["item", "board"],
  });
  // The card is both draggable and droppable, so wire both refs to it.
  const setRef = (el: Element | null) => {
    dragRef(el);
    dropRef(el);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setRef}
          style={{
            width: "100%",
            aspectRatio: "3 / 4",
            opacity: isDragging ? 0.9 : 1,
          }}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-surface-sunken shadow-sm transition-[color,border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-md cursor-grab",
            isDragging && "z-10 cursor-grabbing shadow-panel",
            isDropTarget && "border-brand ring-2 ring-brand bg-brand/5 shadow-md",
          )}
        >
          {/* Item count badge — floats in the top-right corner (no header). */}
          {(board.itemCount ?? 0) > 0 && (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-surface-primary px-1.5 py-0.5 text-[11px] font-medium text-ink-muted shadow-sm">
              {board.itemCount}
            </span>
          )}

          {/* Clickable body — a div (not a button) so the whole card stays
              draggable; dnd-kit cancels drags that start on native buttons. */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }}
            aria-label={`Open board ${board.title}`}
            className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center focus:outline-none"
          >
            <Folder
              size={40}
              strokeWidth={1.25}
              className="text-ink-muted transition-colors group-hover:text-brand"
            />
            <span className="line-clamp-2 text-[14px] font-medium text-ink-primary">
              {board.title}
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onMove}>
          <FolderInput size={14} strokeWidth={1.5} /> Move board...
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:bg-destructive/10"
        >
          <Trash2 size={14} strokeWidth={1.5} /> Delete board
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
