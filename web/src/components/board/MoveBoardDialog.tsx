import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import type { Board } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoardTreePicker } from "./BoardTreePicker";

interface Props {
  board: Board | null;
  boards: Board[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // parentId is null when moving the board to the top level.
  onSelect: (parentId: string | null) => void;
}

// board.id plus every board nested (at any depth) under it — none of these
// can become its new parent without creating a cycle.
function selfAndDescendantIds(board: Board, boards: Board[]): Set<string> {
  const ids = new Set<string>([board.id]);
  for (let added = true; added; ) {
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

export function MoveBoardDialog({ board, boards, open, onOpenChange, onSelect }: Props) {
  const disabledIds = useMemo(
    () => (board ? selfAndDescendantIds(board, boards) : new Set<string>()),
    [board, boards],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move board</DialogTitle>
          <DialogDescription>
            Choose a new parent for “{board?.title}”, or move it to the top level.
          </DialogDescription>
        </DialogHeader>

        {board?.parentId && (
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
          >
            <LayoutGrid size={16} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
            <span className="text-[13px] font-medium text-ink-primary">Move to top level</span>
          </button>
        )}

        <BoardTreePicker
          boards={boards}
          disabledIds={disabledIds}
          disabledLabel={(b) => (b.id === board?.id ? "(current)" : "(sub-board — would create a cycle)")}
          onSelect={onSelect}
        />
      </DialogContent>
    </Dialog>
  );
}
