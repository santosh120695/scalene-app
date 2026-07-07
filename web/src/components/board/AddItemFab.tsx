import {
  FileUp,
  FolderPlus,
  Link2,
  PenTool,
  Plus,
  StickyNote,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onAddNote: () => void;
  onAddLink: () => void;
  onUpload: () => void;
  onAddExcalidraw: () => void;
  onNewSubBoard: () => void;
}

// Circular floating button that opens an overlay menu of item-creation options.
export function AddItemFab({
  onAddNote,
  onAddLink,
  onUpload,
  onAddExcalidraw,
  onNewSubBoard,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Add item"
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-panel transition-transform hover:bg-brand-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={12}
        className="min-w-[168px]"
      >
        <DropdownMenuItem onClick={onAddNote}>
          <StickyNote size={15} strokeWidth={1.5} /> Note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddLink}>
          <Link2 size={15} strokeWidth={1.5} /> Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUpload}>
          <FileUp size={15} strokeWidth={1.5} /> Upload
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddExcalidraw}>
          <PenTool size={15} strokeWidth={1.5} /> Drawing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNewSubBoard}>
          <FolderPlus size={15} strokeWidth={1.5} /> Sub-board
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
