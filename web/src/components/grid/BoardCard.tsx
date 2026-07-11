import { Folder, FolderInput, MoreHorizontal, Trash2 } from "lucide-react";
import type { Board } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// A sub-board shown as a card in the grid (like a folder).
export function BoardCard({ board, onOpen, onDelete, onMove }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={{ width: "100%", aspectRatio: "3 / 4" }}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-surface-sunken shadow-sm transition-[color,border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-surface-primary px-3 py-1.5">
            <Folder
              size={15}
              strokeWidth={1.5}
              className="shrink-0 text-ink-secondary"
            />
            <span className="flex-1 truncate text-[12px] font-medium text-ink-secondary">
              Board
            </span>
            <span className="text-[11px] text-ink-muted">
              {board.itemCount ?? 0}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Board menu"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-md p-0.5 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                >
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onMove}>
                  <FolderInput size={14} strokeWidth={1.5} /> Move board...
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:bg-destructive/10"
                >
                  <Trash2 size={14} strokeWidth={1.5} /> Delete board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            onClick={onOpen}
            aria-label={`Open board ${board.title}`}
            className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
          >
            <Folder
              size={40}
              strokeWidth={1.25}
              className="text-ink-muted transition-colors group-hover:text-brand"
            />
            <span className="line-clamp-2 text-[14px] font-medium text-ink-primary">
              {board.title}
            </span>
          </button>
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
