import { useMemo } from "react";
import type { AnyItem, Board } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoardTreePicker } from "./BoardTreePicker";

interface Props {
  item: AnyItem | null;
  boards: Board[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (boardId: string) => void;
}

export function MoveToBoardDialog({ item, boards, open, onOpenChange, onSelect }: Props) {
  const disabledIds = useMemo(() => new Set(item ? [item.boardId] : []), [item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move to board</DialogTitle>
          <DialogDescription>Choose a destination board for this item.</DialogDescription>
        </DialogHeader>

        <BoardTreePicker boards={boards} disabledIds={disabledIds} onSelect={onSelect} />
      </DialogContent>
    </Dialog>
  );
}
