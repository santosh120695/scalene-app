import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  FolderInput,
  GripVertical,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  PenTool,
  Pin,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { AnyItem, ItemType } from "@/types";
import { cn } from "@/lib/utils";
import { ItemBody } from "@/components/items/ItemBodies";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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
  item: AnyItem;
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
  isNew,
  onOpen,
  onDelete,
  onTogglePin,
  onEdit,
  onMoveToBoard,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    // Slower reorder settle than dnd-kit's 250ms default.
    transition: { duration: 400, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  });

  const Icon = ICONS[item.itemType];

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: "100%",
    maxWidth: 300,
    height: 400,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-type={item.itemType}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-surface-primary transition-colors hover:border-[var(--border-strong)]",
            isDragging && "z-10 cursor-grabbing shadow-panel",
            isNew && "animate-item-pop",
          )}
        >
          {/* Clickable body */}
          <button
            onClick={onOpen}
            className="flex flex-1 flex-col overflow-hidden text-left"
            aria-label={`Open ${itemTitle(item)}`}
          >
            <ItemBody item={item} />
          </button>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5">
            <button
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              className="cursor-grab text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
            >
              <GripVertical size={14} strokeWidth={1.5} />
            </button>
            <Icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
            <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
              {itemTitle(item)}
            </span>
            {item.isPinned && (
              <Pin
                size={14}
                strokeWidth={1.5}
                className="shrink-0 fill-brand text-brand"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Item menu"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-md p-0.5 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                >
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil size={14} strokeWidth={1.5} /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTogglePin}>
                  <Pin size={14} strokeWidth={1.5} />
                  {item.isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveToBoard}>
                  <FolderInput size={14} strokeWidth={1.5} /> Move to board...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:bg-destructive/10"
                >
                  <Trash2 size={14} strokeWidth={1.5} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil size={14} strokeWidth={1.5} /> Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpen}>
          <MessageSquare size={14} strokeWidth={1.5} /> Add sub-note
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
