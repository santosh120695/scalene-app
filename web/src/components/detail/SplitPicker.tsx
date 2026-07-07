import {
  FileText,
  FileUp,
  Image as ImageIcon,
  Link2,
  PenTool,
  StickyNote,
} from "lucide-react";
import type { AnyItem, ItemType } from "@/types";
import { useBoard } from "@/hooks/useBoards";
import { itemAccent } from "@/styles/tokens";
import { ItemBody } from "@/components/items/ItemBodies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ICONS: Record<ItemType, typeof FileText> = {
  pdf: FileText,
  link: Link2,
  note: StickyNote,
  image: ImageIcon,
  excalidraw: PenTool,
};

function itemTitle(item: AnyItem): string {
  switch (item.itemType) {
    case "note":
      return item.title || "Note";
    case "link":
      return item.title || item.domain || "Link";
    case "image":
      return item.caption || "Image";
    case "pdf":
      return item.title || "PDF";
    case "excalidraw":
      return item.title || "Drawing";
  }
}

interface Props {
  boardId: string;
  currentItemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (itemId: string) => void;
  onCreateNew: (type: "note" | "link" | "upload") => void;
}

export function SplitPicker({
  boardId,
  currentItemId,
  open,
  onOpenChange,
  onSelect,
  onCreateNew,
}: Props) {
  const board = useBoard(boardId).data;
  const items = (board?.items ?? []).filter((i) => i.id !== currentItemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open in split</DialogTitle>
          <DialogDescription>
            Create a new item, or choose an existing one to open alongside this one.
          </DialogDescription>
        </DialogHeader>

        {/* Create a brand-new item to open in the split */}
        <div className="flex flex-wrap gap-2">
          <CreateButton icon={StickyNote} label="New note" onClick={() => onCreateNew("note")} />
          <CreateButton icon={Link2} label="New link" onClick={() => onCreateNew("link")} />
          <CreateButton icon={FileUp} label="Upload" onClick={() => onCreateNew("upload")} />
        </div>

        <div className="-mx-6 border-t border-[var(--border)]" />

        {items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">
            No other items on this board.
          </p>
        ) : (
          <div className="scroll-thin grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
            {items.map((item) => {
              const Icon = ICONS[item.itemType];
              const accent = itemAccent[item.itemType];
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  style={{ borderLeft: `3px solid ${accent}` }}
                  className="flex h-[150px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-surface-primary text-left shadow-item transition-shadow hover:shadow-item-hover"
                >
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <ItemBody item={item} />
                  </div>
                  <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5">
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      style={{ color: accent }}
                      className="shrink-0"
                    />
                    <span className="truncate text-[12px] font-medium text-ink-primary">
                      {itemTitle(item)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
      className="flex items-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-brand hover:bg-surface-sunken hover:text-ink-primary"
    >
      <Icon size={15} strokeWidth={1.5} /> {label}
    </button>
  );
}
