import { useState } from "react";
import { Menu } from "lucide-react";
import type { Board, User } from "@/types";
import { Sidebar } from "@/components/sidebar/Sidebar";

interface Props {
  boards: Board[];
  user: User | null;
  /** Title shown in the mobile top bar. */
  mobileTitle: string;
  /** Highlights the active board in the sidebar (board view). */
  activeBoardId?: string;
  /** Highlights the Todos entry in the sidebar (todos view). */
  activeTodos?: boolean;
  onSelectBoard: (id: string) => void;
  onOpenTodos: () => void;
  onNewBoard: () => void;
  onDeleteBoard: (board: Board) => void;
  onMoveBoard: (board: Board) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

/**
 * The page frame shared by the board and todos views: a collapsible desktop
 * sidebar (state persisted across sessions), a mobile off-canvas drawer, and a
 * mobile top bar. Page content is rendered inside the scrolling <main>.
 */
export function AppShell({
  boards,
  user,
  mobileTitle,
  activeBoardId,
  activeTodos,
  onSelectBoard,
  onOpenTodos,
  onNewBoard,
  onDeleteBoard,
  onMoveBoard,
  onLogout,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("kc_sidebar_hidden") !== "1",
  );
  const [mobileNav, setMobileNav] = useState(false);

  function toggleSidebar() {
    const next = !sidebarOpen;
    localStorage.setItem("kc_sidebar_hidden", next ? "0" : "1");
    setSidebarOpen(next);
  }

  // Wrap the nav actions so tapping one in the mobile drawer also closes it.
  const closeAfter =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      fn(...args);
      setMobileNav(false);
    };

  const sidebarProps = {
    boards,
    activeBoardId,
    activeTodos,
    user,
    onDeleteBoard,
    onLogout,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-card">
      {/* Desktop sidebar — collapsible rail, hidden on mobile */}
      <div className="hidden lg:flex">
        <Sidebar
          {...sidebarProps}
          collapsed={!sidebarOpen}
          onToggle={toggleSidebar}
          onSelectBoard={onSelectBoard}
          onOpenTodos={onOpenTodos}
          onNewBoard={onNewBoard}
          onMoveBoard={onMoveBoard}
        />
      </div>

      {/* Mobile off-canvas drawer + backdrop */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-panel">
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggle={() => setMobileNav(false)}
              onSelectBoard={closeAfter(onSelectBoard)}
              onOpenTodos={closeAfter(onOpenTodos)}
              onNewBoard={closeAfter(onNewBoard)}
              onMoveBoard={closeAfter(onMoveBoard)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="scroll-thin flex-1 overflow-y-auto bg-card">
          {/* Mobile top bar — hamburger to open the nav drawer */}
          <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-[var(--border)] bg-card px-3 lg:hidden">
            <button
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <span className="font-display text-[16px] font-semibold text-ink-primary">
              {mobileTitle}
            </span>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
