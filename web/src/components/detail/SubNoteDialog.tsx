import { NotebookPen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ItemTreePicker, type PickedItem } from "@/components/detail/ItemTreePicker";
import { useBoardsList } from "@/hooks/useBoards";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The note the link is being written into — never offered as a target.
  currentItemId: string;
  busy?: boolean;
  // Create a brand-new note nested under the current one.
  onCreate: () => void;
  // Link a note that already exists. It is NOT reparented: picking is a
  // cross-reference, so an existing note keeps its place on its own board.
  onPick: (itemId: string, meta?: PickedItem) => void;
}

/**
 * Create a sub-note, or link an existing note, from inside the editor.
 *
 * Modal on purpose: ProseMirror keeps its selection while the DOM focus moves
 * here, so the chip lands where the "/" was typed — but only because a modal
 * makes it impossible to click somewhere else in the note first.
 */
export function SubNoteDialog({
  open,
  onOpenChange,
  currentItemId,
  busy,
  onCreate,
  onPick,
}: Props) {
  const boards = useBoardsList().data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a sub-note</DialogTitle>
          <DialogDescription>
            Create a note nested inside this one, or link a note you already have.
          </DialogDescription>
        </DialogHeader>

        <button
          onClick={onCreate}
          disabled={busy}
          className="mb-3 flex w-full items-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:border-brand hover:bg-surface-sunken hover:text-ink-primary disabled:opacity-60"
        >
          <NotebookPen size={15} strokeWidth={1.5} />
          {busy ? "Creating…" : "New sub-note"}
        </button>

        <div className="border-t border-[var(--border)] pt-3">
          <span className="label-caps mb-2 block text-ink-muted">
            Or link an existing note
          </span>
          <div className="max-h-[320px] overflow-y-auto">
            <ItemTreePicker
              boards={boards}
              excludeItemId={currentItemId}
              onSelectItem={onPick}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
