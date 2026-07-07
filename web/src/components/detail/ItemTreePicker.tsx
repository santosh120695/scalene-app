import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  PenTool,
  StickyNote,
} from "lucide-react";
import type { AnyItem, Board, ItemType } from "@/types";
import { useBoard } from "@/hooks/useBoards";
import { useSearch } from "@/hooks/useSearch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  boards: Board[];
  onSelectItem: (itemId: string) => void;
}

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

function ItemRow({ depth, icon: Icon, title, subtitle, onClick }: {
  depth: number;
  icon: typeof FileText;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ paddingLeft: depth * 18 + 26 }}
      className="flex items-center gap-2.5 rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-surface-sunken"
    >
      <Icon size={15} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-primary">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-ink-muted">{subtitle}</span>}
      </span>
    </button>
  );
}

// A board node in the tree — expands to reveal its child boards and its own
// items. Items are fetched lazily (only once this node is expanded) via the
// same useBoard() query the main board view uses, so browsing the tree adds
// no extra requests beyond what you actually open.
function BoardNode({
  board,
  depth,
  childrenByParent,
  expanded,
  onToggle,
  onSelectItem,
}: {
  board: Board;
  depth: number;
  childrenByParent: Map<string | null, Board[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelectItem: (itemId: string) => void;
}) {
  const kids = childrenByParent.get(board.id) ?? [];
  const hasItems = (board.itemCount ?? 0) > 0;
  const isExpandable = kids.length > 0 || hasItems;
  const isExpanded = expanded.has(board.id);

  const boardDetail = useBoard(isExpanded && hasItems ? board.id : undefined);
  const items = boardDetail.data?.items ?? [];

  return (
    <div>
      <button
        onClick={() => isExpandable && onToggle(board.id)}
        style={{ paddingLeft: depth * 18 }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors",
          isExpandable ? "hover:bg-surface-sunken" : "cursor-default opacity-60",
        )}
      >
        {isExpandable ? (
          isExpanded ? (
            <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
          ) : (
            <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Folder size={15} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-primary">
          {board.title}
        </span>
        {hasItems && (
          <span className="shrink-0 text-[11px] text-ink-muted">{board.itemCount}</span>
        )}
      </button>

      {isExpanded && (
        <>
          {hasItems && boardDetail.isLoading && (
            <p style={{ paddingLeft: depth * 18 + 26 }} className="py-1 text-[12px] text-ink-muted">
              Loading…
            </p>
          )}
          {items.map((item) => (
            <ItemRow
              key={item.id}
              depth={depth + 1}
              icon={ICONS[item.itemType]}
              title={itemTitle(item)}
              onClick={() => onSelectItem(item.id)}
            />
          ))}
          {kids.map((k) => (
            <BoardNode
              key={k.id}
              board={k}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onSelectItem={onSelectItem}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Tree-with-search picker for choosing any item across every board — used by
// the split-view browser. Defaults to a collapsed board tree (mirroring
// BoardTreePicker); typing switches to a flat cross-board item search.
export function ItemTreePicker({ boards, onSelectItem }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const searching = debounced.trim().length > 0;
  const searchQuery = useSearch(debounced);

  const childrenByParent = useMemo(() => groupByParent(boards), [boards]);
  const roots = childrenByParent.get(null) ?? [];

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search all items…"
      />

      <div className="scroll-thin flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto py-1">
        {searching ? (
          searchQuery.isLoading ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">Searching…</p>
          ) : (searchQuery.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">No matching items.</p>
          ) : (
            (searchQuery.data ?? []).map((r) => (
              <ItemRow
                key={r.itemId}
                depth={0}
                icon={ICONS[r.cardType]}
                title={r.title || "Untitled"}
                subtitle={r.boardTitle}
                onClick={() => onSelectItem(r.itemId)}
              />
            ))
          )
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">No boards yet.</p>
        ) : (
          roots.map((b) => (
            <BoardNode
              key={b.id}
              board={b}
              depth={0}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={toggle}
              onSelectItem={onSelectItem}
            />
          ))
        )}
      </div>
    </>
  );
}
