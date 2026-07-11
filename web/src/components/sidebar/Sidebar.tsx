import { useState } from "react";
import {
  ListTodo,
  LogOut,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  StickyNote,
  Sun,
  Trash2,
  Folder,
  FolderInput,
} from "lucide-react";
import type { Board, User } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "alpha" | "items";

interface Props {
  boards: Board[];
  activeBoardId?: string;
  activeTodos?: boolean;
  collapsed: boolean;
  user: User | null;
  onToggle: () => void;
  onSelectBoard: (id: string) => void;
  onOpenTodos: () => void;
  onNewBoard: () => void;
  onDeleteBoard: (board: Board) => void;
  onMoveBoard: (board: Board) => void;
  onLogout: () => void;
}

export function Sidebar(props: Props) {
  if (props.collapsed) return <CollapsedRail {...props} />;
  return <ExpandedSidebar {...props} />;
}

function sortBoards(list: Board[], sort: SortKey): Board[] {
  return [...list].sort((a, b) => {
    if (sort === "alpha") return a.title.localeCompare(b.title);
    if (sort === "items") return (b.itemCount ?? 0) - (a.itemCount ?? 0);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function ExpandedSidebar({
  boards,
  activeBoardId,
  activeTodos,
  user,
  onToggle,
  onSelectBoard,
  onOpenTodos,
  onNewBoard,
  onDeleteBoard,
  onMoveBoard,
  onLogout,
}: Props) {
  const [sort, setSort] = useState<SortKey>("recent");
  const initial = (user?.fullName || user?.email || "?")
    .charAt(0)
    .toUpperCase();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  // Sidebar shows only top-level boards; sub-boards appear as cards in the grid.
  const roots = sortBoards(
    boards.filter((b) => !b.parentId),
    sort,
  );

  return (
    <aside className="flex h-full w-[90vw] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar)] lg:w-[270px]">
      {/* Header: logo + collapse button — h-12 to match the content header. */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[13px] font-semibold text-primary-foreground">
            S
          </div>
          <span className="font-display text-[18px] font-semibold text-ink-primary">
            Scalene
          </span>
        </div>
        <button
          onClick={onToggle}
          aria-label="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
        >
          <PanelLeftClose size={17} strokeWidth={1.5} />
        </button>
      </div>

      {/* Todos — directly below the header */}
      <div className="px-3 pt-3 pb-1">
        <SidebarItem
          icon={ListTodo}
          label="Todos"
          onClick={onOpenTodos}
          active={activeTodos}
        />
      </div>

      {/* Boards nav header: label + sort + new-board — New Board lives here now */}
      <div className="mt-5 flex items-center justify-between px-3 pt-3 pb-1">
        <span className="font-semibold text-ink-muted">Boards</span>
        <div className="flex items-center gap-1">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer bg-transparent text-[11px] text-ink-secondary outline-none"
            aria-label="Sort boards"
          >
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
            <option value="items">Most items</option>
          </select>
          <button
            onClick={onNewBoard}
            aria-label="New board"
            title="New board"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Scrollable board list (top-level only) */}
      <nav className="scroll-thin flex-1 overflow-y-auto pb-3 mt-1">
        {roots.map((board) => (
          <BoardRow
            key={board.id}
            board={board}
            active={board.id === activeBoardId}
            onSelect={() => onSelectBoard(board.id)}
            onDelete={() => onDeleteBoard(board)}
            onMove={() => onMoveBoard(board)}
          />
        ))}
        {roots.length === 0 && (
          <p className="px-4 py-3 text-[12px] text-ink-muted">No boards yet.</p>
        )}
      </nav>

      {/* Bottom: user info + logout */}
      <div className="flex items-center gap-2.5 border-t border-[var(--border)] p-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink-primary">
            {user?.fullName || "Account"}
          </p>
          <p className="truncate text-[11px] text-ink-muted">{user?.email}</p>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
        >
          {theme === "dark" ? (
            <Sun size={16} strokeWidth={1.5} />
          ) : (
            <Moon size={16} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={onLogout}
          aria-label="Log out"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
        >
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}

function BoardRow({
  board,
  active,
  onSelect,
  onDelete,
  onMove,
}: {
  board: Board;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-2.5 px-4 py-2 text-[14px] transition-colors hover:bg-surface-sunken",
            active
              ? "border-l-2 border-brand bg-brand-light pl-[14px] font-semibold text-brand"
              : "font-bold text-ink-secondary",
          )}
        >
          <button
            onClick={onSelect}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <Folder size={15} strokeWidth={1.5} className="shrink-0" />
            <span className="flex-1 truncate font-medium first-letter:uppercase">
              {board.title}
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`Delete ${board.title}`}
            title="Delete board"
            className="shrink-0 rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
          {/*<span className="shrink-0 text-[11px] text-ink-muted">
            {board.itemCount ?? 0}
            //{" "}
          </span>*/}
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

// Slim icon rail shown when the sidebar is collapsed.
function CollapsedRail({
  user,
  activeTodos,
  onToggle,
  onNewBoard,
  onOpenTodos,
  onLogout,
}: Props) {
  const initial = (user?.fullName || user?.email || "?")
    .charAt(0)
    .toUpperCase();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  return (
    <aside className="flex h-full w-[56px] shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-page py-3">
      <RailButton icon={PanelLeft} label="Expand sidebar" onClick={onToggle} />
      <div className="my-1 h-px w-7 bg-[var(--border)]" />
      <RailButton
        icon={ListTodo}
        label="Todos"
        onClick={onOpenTodos}
        active={activeTodos}
      />
      <div className="mt-1 mb-2.5 h-px w-7 bg-[var(--border)]" />
      <RailButton icon={Plus} label="New board" onClick={onNewBoard} />

      <div className="flex-1" />

      <RailButton
        icon={theme === "dark" ? Sun : Moon}
        label={theme === "dark" ? "Light mode" : "Dark mode"}
        onClick={toggleTheme}
      />
      <Avatar className="h-8 w-8">
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <RailButton icon={LogOut} label="Log out" onClick={onLogout} />
    </aside>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof StickyNote;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled font-normal",
        active
          ? "bg-brand-light text-brand"
          : "text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary",
      )}
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}

// Shared ghost-style sidebar row (used by Note/Link/Upload, New Board, Todos).
function SidebarItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof StickyNote;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[14px] font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-brand-light text-brand"
          : "text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary",
      )}
    >
      <Icon size={16} strokeWidth={1.5} /> {label}
    </button>
  );
}
