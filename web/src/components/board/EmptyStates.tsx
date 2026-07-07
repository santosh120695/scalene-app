import { FileUp, Link2, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";

// Board with no items — invitation + 3 ghost placeholders (PRD onboarding step 3).
export function EmptyBoard({
  onAddLink,
  onUpload,
  onAddNote,
}: {
  onAddLink: () => void;
  onUpload: () => void;
  onAddNote: () => void;
}) {
  const ghosts = [
    { icon: Link2, label: "Paste a link", onClick: onAddLink },
    { icon: FileUp, label: "Upload a PDF", onClick: onUpload },
    { icon: StickyNote, label: "Write a note", onClick: onAddNote },
  ];
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center px-6 py-16 text-center">
      <h2 className="font-display text-[28px] italic text-ink-primary">
        This board is empty.
      </h2>
      <p className="mt-2 text-[14px] text-ink-muted">
        Drop a link, upload a PDF, or write your first note.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {ghosts.map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex h-[140px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--border-default)] bg-surface-primary/40 text-ink-muted transition-colors hover:border-brand hover:text-brand"
          >
            <Icon size={22} strokeWidth={1.5} />
            <span className="text-[13px]">{label}</span>
          </button>
        ))}
      </div>
      <Button className="mt-8" onClick={onAddNote}>
        <Plus size={16} strokeWidth={1.5} /> Add your first item
      </Button>
    </div>
  );
}

// No boards yet.
export function EmptyBoardsList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h2 className="font-display text-[28px] italic text-ink-primary">
        Start a new board.
      </h2>
      <p className="mt-2 max-w-xs text-[14px] text-ink-muted">
        Boards are where your ideas live.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus size={16} strokeWidth={1.5} /> Create your first board
      </Button>
    </div>
  );
}

// Generic centered message (e.g. no board selected).
export function CenteredMessage({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h2 className="font-display text-[26px] italic text-ink-primary">{title}</h2>
      {body && <p className="mt-2 max-w-sm text-[14px] text-ink-muted">{body}</p>}
    </div>
  );
}
