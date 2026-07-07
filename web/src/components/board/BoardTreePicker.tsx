import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { Board } from "@/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  boards: Board[];
  // Ids that can't be selected (shown grayed out with the label from `disabledLabel`).
  disabledIds: Set<string>;
  disabledLabel?: (board: Board) => string;
  emptyLabel?: string;
  onSelect: (boardId: string) => void;
}

// Breadcrumb path from the root board down to `board`, e.g. "Research / Papers".
function breadcrumb(board: Board, byId: Map<string, Board>): string {
  const chain: string[] = [];
  let cur: Board | undefined = board;
  while (cur) {
    chain.unshift(cur.title);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  chain.pop(); // drop the board's own title, keep only its ancestors
  return chain.join(" / ");
}

// Groups boards by parentId (null key = root boards), each group sorted alphabetically.
function groupByParent(boards: Board[]): Map<string | null, Board[]> {
  const groups = new Map<string | null, Board[]>();
  for (const b of boards) {
    const key = b.parentId ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return groups;
}

// Tree-with-search board picker shared by "move item to board" and "move
// board to board" — nests boards under their parent, collapsed by default,
// and falls back to a flat breadcrumb-labeled list while searching.
export function BoardTreePicker({
  boards,
  disabledIds,
  disabledLabel = () => "(current)",
  emptyLabel = "No boards yet.",
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  // Ids of nodes the user has explicitly expanded — everything else starts closed.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const byId = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const childrenByParent = useMemo(() => groupByParent(boards), [boards]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const flatMatches = useMemo(() => {
    if (!searching) return [];
    return boards
      .filter((b) => b.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [boards, q, searching]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRow(board: Board) {
    if (disabledIds.has(board.id)) return;
    onSelect(board.id);
  }

  function BoardRow({ board, depth, subtitle }: { board: Board; depth: number; subtitle?: string }) {
    const kids = childrenByParent.get(board.id) ?? [];
    const hasChildren = kids.length > 0;
    const isCollapsed = !expanded.has(board.id);
    const isDisabled = disabledIds.has(board.id);

    return (
      <div key={board.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(board.id)}
              aria-label={isCollapsed ? `Expand ${board.title}` : `Collapse ${board.title}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-muted transition-colors hover:text-ink-primary"
            >
              {isCollapsed ? (
                <ChevronRight size={14} strokeWidth={1.5} />
              ) : (
                <ChevronDown size={14} strokeWidth={1.5} />
              )}
            </button>
          ) : (
            <span className="h-6 w-6 shrink-0" />
          )}
          <button
            onClick={() => selectRow(board)}
            disabled={isDisabled}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
              isDisabled ? "cursor-default opacity-50" : "hover:bg-surface-sunken",
            )}
          >
            <Folder size={16} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-primary">
                {board.title}
                {isDisabled && (
                  <span className="ml-1.5 text-[11px] text-ink-muted">{disabledLabel(board)}</span>
                )}
              </span>
              {subtitle && (
                <span className="block truncate text-[11px] text-ink-muted">{subtitle}</span>
              )}
            </span>
          </button>
        </div>
        {hasChildren && !isCollapsed && kids.map((k) => (
          <BoardRow key={k.id} board={k} depth={depth + 1} />
        ))}
      </div>
    );
  }

  const roots = childrenByParent.get(null) ?? [];

  return (
    <>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search boards…"
      />

      <div className="scroll-thin flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto py-1">
        {searching ? (
          flatMatches.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">No matching boards.</p>
          ) : (
            flatMatches.map((b) => (
              <BoardRow key={b.id} board={b} depth={0} subtitle={breadcrumb(b, byId)} />
            ))
          )
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">{emptyLabel}</p>
        ) : (
          roots.map((b) => <BoardRow key={b.id} board={b} depth={0} />)
        )}
      </div>
    </>
  );
}
