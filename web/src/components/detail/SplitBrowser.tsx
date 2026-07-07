import { FileUp, Link2, StickyNote, X, FileText } from "lucide-react";
import { useBoard } from "@/hooks/useBoards";
import type { Board } from "@/types";
import { ItemTreePicker } from "@/components/detail/ItemTreePicker";

interface Props {
  boardId: string;
  boards: Board[];
  onSelect: (itemId: string) => void;
  onClose: () => void;
  onCreateNew: (type: "note" | "link" | "upload") => void;
}

export function SplitBrowser({ boardId, boards, onSelect, onClose, onCreateNew }: Props) {
  const { data: board } = useBoard(boardId);

  return (
    <div className="flex h-full flex-col bg-card animate__animated animate__faster animate__slideInRight">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-card px-4">
        <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
          {board?.title ?? "Items"}
        </span>
        <div className="flex items-center gap-1">
          <CreateButton icon={StickyNote} label="Note"   onClick={() => onCreateNew("note")} />
          <CreateButton icon={Link2}      label="Link"   onClick={() => onCreateNew("link")} />
          <CreateButton icon={FileUp}     label="Upload" onClick={() => onCreateNew("upload")} />
        </div>
        <button
          onClick={onClose}
          aria-label="Close split"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </header>

      {/* Browse every board's items as a tree, or search across all of them */}
      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        <ItemTreePicker boards={boards} onSelectItem={onSelect} />
      </div>
    </div>
  );
}

function CreateButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[12px] font-medium text-ink-secondary transition-colors hover:border-brand hover:bg-surface-sunken hover:text-ink-primary"
    >
      <Icon size={13} strokeWidth={1.5} /> {label}
    </button>
  );
}
