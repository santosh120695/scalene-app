import { useSortable } from "@dnd-kit/react/sortable";
import {
  FolderInput,
  MessageSquare,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import type { AnyItem } from "@/types";
import { cn } from "@/lib/utils";
import { ItemBody } from "@/components/items/ItemBodies";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

function itemTitle(item: AnyItem): string {
  switch (item.itemType) {
    case "note":
      return item.title || "Untitled note";
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
  item: AnyItem;
  index: number;
  isNew?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSetColor: (color: string) => void;
  onEdit: () => void;
  onMoveToBoard: () => void;
}

export function GridItem({
  item,
  index,
  isNew,
  onOpen,
  onDelete,
  onTogglePin,
  onEdit,
  onMoveToBoard,
}: Props) {
  const { ref, isDragging } = useSortable({
    id: item.id,
    index,
    type: "item",
    // Slower reorder settle than dnd-kit's 250ms default.
    transition: { duration: 400, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });

  const style: React.CSSProperties = {
    width: "100%",
    aspectRatio: "3 / 4",
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={ref}
          style={style}
          data-type={item.itemType}
          className={cn(
            "group relative shadow-sm flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-surface-primary transition-colors hover:border-[var(--border-strong)] animate__animated animate__pulse cursor-grab",
            isDragging && "z-10 cursor-grabbing shadow-panel",
            isNew && "animate-item-pop",
          )}
        >
          {/* Pinned badge — floats in the top-right corner (no header). */}
          {item.isPinned && (
            <Pin
              size={14}
              strokeWidth={1.5}
              className="absolute right-2 top-2 z-10 shrink-0 fill-brand text-brand"
            />
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
            className="flex flex-1 flex-col overflow-hidden text-left focus:outline-none"
            aria-label={`Open ${itemTitle(item)}`}
          >
            <ItemBody item={item} />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil size={14} strokeWidth={1.5} /> Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpen}>
          <MessageSquare size={14} strokeWidth={1.5} /> Add comment
        </ContextMenuItem>
        <ContextMenuItem onClick={onTogglePin}>
          <Pin size={14} strokeWidth={1.5} />{" "}
          {item.isPinned ? "Unpin" : "Pin to top"}
        </ContextMenuItem>
        <ContextMenuItem onClick={onMoveToBoard}>
          <FolderInput size={14} strokeWidth={1.5} /> Move to board...
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:bg-destructive/10"
        >
          <Trash2 size={14} strokeWidth={1.5} /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
