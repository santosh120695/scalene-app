import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Columns2,
  ExternalLink,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import * as itemsApi from "@/api/items";
import { boardKeys, useBoardsList } from "@/hooks/useBoards";
import { todoKeys } from "@/hooks/useTodos";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { SubNotes } from "@/components/detail/SubNotes";
import { Button } from "@/components/ui/button";
import { cn, sanitizeHtml } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import type { AnyItem, ExcalidrawItem, NoteItem } from "@/types";

// The drawing editor is only needed when a drawing is opened, so keep it out
// of the initial bundle with a lazy import.
const ExcalidrawEditor = lazy(() =>
  import("@/components/editor/ExcalidrawEditor").then((m) => ({
    default: m.ExcalidrawEditor,
  })),
);

// EmbedPDF pulls in a large PDFium/WASM bundle — load it only when a PDF is
// actually opened so it stays out of the initial app bundle.
const PdfViewer = lazy(() =>
  import("@/components/detail/PdfViewer").then((m) => ({
    default: m.PdfViewer,
  })),
);

interface Props {
  itemId: string;
  boardId: string;
  // When set, this view is one pane of a split — show a close-pane button.
  onClosePane?: () => void;
}

export function ItemDetailView({ itemId, boardId, onClosePane }: Props) {
  const navigate = useNavigate();
  const { itemId: routeItemId } = useParams();
  const qc = useQueryClient();
  const boards = useBoardsList().data ?? [];
  const [noteStatus, setNoteStatus] = useState("");
  const [subNotesOpen, setSubNotesOpen] = useState(false);

  // Ancestor chain (root → … → current board) for the breadcrumb trail.
  const breadcrumbs = useMemo(() => {
    const byId = new Map(boards.map((b) => [b.id, b]));
    const chain: { id: string; title: string }[] = [];
    let cur = byId.get(boardId);
    while (cur) {
      chain.unshift({ id: cur.id, title: cur.title });
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain;
  }, [boards, boardId]);
  const ancestors = breadcrumbs.slice(0, -1);
  const currentBoard = breadcrumbs[breadcrumbs.length - 1];

  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.getItem(itemId),
    enabled: !!itemId,
  });

  function backToBoard() {
    navigate(`/b/${boardId}`);
  }

  function closePane() {
    if (!onClosePane) return;
    onClosePane();
  }

  async function remove() {
    try {
      await itemsApi.deleteItem(itemId);
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      qc.invalidateQueries({ queryKey: boardKeys.list });
      toast.success("Item deleted");
      if (onClosePane) closePane();
      else backToBoard();
    } catch (e) {
      toast.error(errMessage(e, "Could not delete"));
    }
  }

  // Esc returns to the board.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") backToBoard();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const originalUrl =
    item?.itemType === "link"
      ? item.url
      : item?.itemType === "pdf" || item?.itemType === "image"
        ? item.filePath
        : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center py-3 gap-2 border-b border-[var(--border)] bg-card px-3 sm:gap-3 sm:px-4">
        <nav className="flex min-w-0 items-center gap-1 text-[13px]">
          {ancestors.map((crumb) => (
            <span
              key={crumb.id}
              className="hidden shrink-0 items-center gap-1 sm:flex"
            >
              <button
                onClick={() => navigate(`/b/${crumb.id}`)}
                className="max-w-[100px] truncate text-ink-secondary transition-colors hover:text-brand sm:max-w-[140px]"
              >
                {crumb.title}
              </button>
              <ChevronRight
                size={13}
                strokeWidth={1.5}
                className="shrink-0 text-ink-muted opacity-60"
              />
            </span>
          ))}
          {/* Current board — links back to the board grid. */}
          <button
            onClick={backToBoard}
            className="max-w-[80px] shrink-0 truncate text-ink-secondary transition-colors hover:text-brand sm:max-w-[160px]"
          >
            {currentBoard?.title ?? "Board"}
          </button>
          <ChevronRight
            size={13}
            strokeWidth={1.5}
            className="shrink-0 text-ink-muted opacity-60"
          />
          {/* Current item — final crumb, present on every detail page. */}
          <span className="min-w-0 truncate font-medium text-ink-primary">
            {item ? itemLabel(item) : "…"}
          </span>
        </nav>
        {item?.itemType === "note" && (
          <span className="hidden text-[12px] text-ink-muted sm:inline">
            {noteStatus}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {originalUrl && (
            <Button asChild variant="ghost" size="sm">
              <a href={originalUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">Open original</span>
              </a>
            </Button>
          )}
          {item &&
            item.itemType !== "note" &&
            item.itemType !== "excalidraw" && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Toggle sub-notes"
                onClick={() => setSubNotesOpen((o) => !o)}
                className={cn(subNotesOpen && "bg-brand-light text-brand")}
              >
                <MessageSquare size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">Sub-notes</span>
              </Button>
            )}
          {!onClosePane && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open split view"
              className="hidden sm:inline-flex"
              onClick={() =>
                navigate(
                  `/b/${boardId}/item/${routeItemId ?? itemId}?split=browse`,
                )
              }
            >
              <Columns2 size={14} strokeWidth={1.5} /> Split
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete item"
            onClick={remove}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline">Delete</span>
          </Button>
          {onClosePane && (
            <button
              onClick={closePane}
              aria-label="Close pane"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>
      <div className="animate__animated animate__faster animate__zoomIn flex min-h-0 flex-1 flex-col">
        {isLoading || !item ? (
          <div className="flex-1 px-10 py-8">
            <LoadingBody />
          </div>
        ) : item.itemType === "note" ? (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <div className="note-doc mx-auto w-full max-w-[1000px] px-1 sm:px-12 py-8">
              <NoteEditor
                key={item.id}
                note={item as NoteItem}
                boardId={boardId}
                onStatus={setNoteStatus}
              />
            </div>
          </div>
        ) : item.itemType === "excalidraw" ? (
          <div className="flex min-h-0 flex-1">
            <ExcalidrawPane
              key={item.id}
              drawing={item as ExcalidrawItem}
              boardId={boardId}
            />
          </div>
        ) : (
          // Split view: content (3) on the left, sub-notes (1) on the right.
          <div className="flex min-h-0 flex-1">
            {item.itemType === "pdf" ? (
              // The PDF viewer manages its own scrolling and chrome, so let it
              // fill the whole pane rather than sitting in a padded column.
              <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
                <MediaDetail item={item} />
              </div>
            ) : (
              <div className="scroll-thin flex-[3] overflow-y-auto">
                <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-12">
                  <MediaDetail item={item} />
                </div>
              </div>
            )}
            {subNotesOpen && (
              <aside className="scroll-thin flex-1 min-w-[260px] overflow-y-auto border-l border-[var(--border)] bg-surface-primary p-5">
                <SubNotes itemId={item.id} />
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full-page note editor (no sub-notes) ──
function NoteEditor({
  note,
  boardId,
  onStatus,
}: {
  note: NoteItem;
  boardId: string;
  onStatus: (status: string) => void;
}) {
  const qc = useQueryClient();
  // const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const dirty = useRef(false);

  const setStatus = onStatus;

  useEffect(() => () => onStatus(""), [onStatus]);

  const extractTitle = (content: string): string => {
    const parser = new DOMParser().parseFromString(content, "text/html");
    return parser.body.children[0].textContent.trim() ?? "";
  };

  async function save() {
    if (!dirty.current) return;
    setStatus("Saving…");
    try {
      const title = extractTitle(content);
      const updated = (await itemsApi.updateNote(note.id, {
        title,
        content,
      })) as NoteItem;
      dirty.current = false;
      // The backend injects a stable id into any new checklist item so it can
      // be toggled from the central Todos view — pick up that rewritten HTML.
      if (updated.content && updated.content !== content) {
        setContent(updated.content);
      }
      setStatus("Saved");
      qc.invalidateQueries({ queryKey: ["item", note.id] });
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      // Checklist items may have been checked/unchecked or deleted in this
      // save — keep the central Todos view from showing stale/removed items.
      qc.invalidateQueries({ queryKey: todoKeys.list });
    } catch (e) {
      setStatus("");
      toast.error(errMessage(e, "Could not save note"));
    }
  }

  return (
    <>
      <RichTextEditor
        value={content}
        onChange={(html) => {
          setContent(html);
          dirty.current = true;
          setStatus("");
        }}
        onBlur={save}
        placeholder="Type '/' for commands, or just start writing…"
        minHeight={600}
        className="bg-card"
        bare
      />
    </>
  );
}

// ── Full-page drawing canvas ──
function ExcalidrawPane({
  drawing,
  boardId,
}: {
  drawing: ExcalidrawItem;
  boardId: string;
}) {
  const qc = useQueryClient();

  async function save(data: { sceneData: object; thumbnail: string }) {
    try {
      await itemsApi.updateExcalidraw(drawing.id, data);
      qc.invalidateQueries({ queryKey: ["item", drawing.id] });
      qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    } catch (e) {
      toast.error(errMessage(e, "Could not save drawing"));
    }
  }

  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ExcalidrawEditor initialData={drawing.sceneData} onSave={save} />
    </Suspense>
  );
}

// ── Read-only detail for link / image / pdf ──
function MediaDetail({ item }: { item: AnyItem }) {
  if (item.itemType === "link") {
    const hasArticle = !!item.content;
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight text-ink-primary">
          {item.title || item.domain || "Link"}
        </h1>
        <p className="text-[13px] text-ink-muted">
          {item.byline ? `${item.byline} · ` : ""}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            {item.domain || item.url}
          </a>
        </p>

        {hasArticle ? (
          // Pocket-style reader view of the extracted article.
          <article
            className="reader mt-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content!) }}
          />
        ) : (
          <>
            {item.thumbnailUrl && (
              <img
                src={item.thumbnailUrl}
                alt={item.title || "Link preview"}
                className="mt-1 w-full rounded-xl object-cover"
              />
            )}
            {item.description && (
              <p className="text-[15px] leading-relaxed text-ink-secondary">
                {item.description}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  if (item.itemType === "image") {
    return (
      <div className="flex flex-col gap-4">
        <img
          src={item.filePath}
          alt={item.caption || "Image"}
          className="w-full rounded-xl object-contain"
        />
        {item.caption && (
          <p className="text-center text-[14px] text-ink-secondary">
            {item.caption}
          </p>
        )}
      </div>
    );
  }

  if (item.itemType !== "pdf") return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="h-full bg-surface-sunken" />}>
          <PdfViewer url={item.filePath} />
        </Suspense>
      </div>
      <p className="shrink-0 px-4 text-[12px] text-ink-muted">
        {item.pageCount ? `${item.pageCount} pages · ` : ""}
        {(item.fileSize / 1024 / 1024).toFixed(1)} MB
      </p>
    </div>
  );
}

// Short label for the item's breadcrumb crumb, per item type.
function itemLabel(item: AnyItem): string {
  switch (item.itemType) {
    case "note":
      return item.title?.trim() || "Untitled note";
    case "link":
      return item.title?.trim() || item.domain || "Link";
    case "image":
      return item.caption?.trim() || "Image";
    case "pdf":
      return item.title?.trim() || "PDF";
    case "excalidraw":
      return item.title?.trim() || "Drawing";
  }
}

function LoadingBody() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
