import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Columns2,
  ExternalLink,
  MessageSquare,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import * as itemsApi from "@/api/items";
import { boardKeys, useBoardsList } from "@/hooks/useBoards";
import { NoteWithComments } from "@/components/detail/NoteWithComments";
import { Button } from "@/components/ui/button";
import { cn, sanitizeHtml } from "@/lib/utils";
import { detectEmbed } from "@/lib/embeds";
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
  const [commentsOpen, setCommentsOpen] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => itemsApi.getItem(itemId),
    enabled: !!itemId,
  });

  // The `boardId` prop is the route's board, which belongs to the LEFT pane —
  // AppPage passes the same value to both panes. An item opened in the right
  // pane can live on a different board (a cross-board note link), so trust the
  // fetched item and fall back to the prop only while it loads.
  const effectiveBoardId = item?.boardId ?? boardId;

  // Ancestor chain (root → … → current board) for the breadcrumb trail.
  const breadcrumbs = useMemo(() => {
    const byId = new Map(boards.map((b) => [b.id, b]));
    const chain: { id: string; title: string }[] = [];
    let cur = byId.get(effectiveBoardId);
    while (cur) {
      chain.unshift({ id: cur.id, title: cur.title });
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain;
  }, [boards, effectiveBoardId]);
  const ancestors = breadcrumbs.slice(0, -1);
  const currentBoard = breadcrumbs[breadcrumbs.length - 1];
  // A sub-note sits under one or more parent notes; the server returns that
  // chain root-most first (walking it client-side would mean N sequential
  // fetches with no ids to start from).
  const noteAncestors =
    item?.itemType === "note" ? (item.parentChain ?? []) : [];

  function backToBoard() {
    navigate(`/b/${effectiveBoardId}`);
  }

  function closePane() {
    if (!onClosePane) return;
    onClosePane();
  }

  async function remove() {
    try {
      await itemsApi.deleteItem(itemId);
      qc.invalidateQueries({ queryKey: boardKeys.detail(effectiveBoardId) });
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
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center py-3 gap-2  bg-card px-3 sm:gap-3 sm:px-4">
        {/* Clips rather than pushing the actions off the edge: a nested note's
            trail can be long, and a split pane is half the usual width. */}
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[13px]">
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
          {/* Parent notes, when this is a sub-note. A distinct icon keeps the
              board/note boundary readable in a long trail. */}
          {noteAncestors.map((crumb) => (
            <span key={crumb.id} className="hidden shrink-0 items-center gap-1 sm:flex">
              <button
                onClick={() => navigate(`/b/${effectiveBoardId}/item/${crumb.id}`)}
                className="flex max-w-[100px] items-center gap-1 truncate text-ink-secondary transition-colors hover:text-brand sm:max-w-[140px]"
              >
                <StickyNote size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{crumb.title || "Untitled note"}</span>
              </button>
              <ChevronRight
                size={13}
                strokeWidth={1.5}
                className="shrink-0 text-ink-muted opacity-60"
              />
            </span>
          ))}
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
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {originalUrl && (
            <Button asChild variant="ghost" size="sm">
              <a href={originalUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">Open original</span>
              </a>
            </Button>
          )}
          {item?.itemType === "note" && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle comments"
              onClick={() => setCommentsOpen((o) => !o)}
              className={cn(commentsOpen && "bg-brand-light text-brand")}
            >
              <MessageSquare size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Comments</span>
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
                  `/b/${effectiveBoardId}/item/${routeItemId ?? itemId}?split=browse`,
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
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          // The zoomIn entry animation applies a CSS transform. Excalidraw sizes
          // its canvas from getBoundingClientRect on mount; a transformed
          // ancestor makes it measure a scaled (or zero) rect and never recover,
          // so the drawing canvas collapses. Skip the animation for drawings.
          item?.itemType !== "excalidraw" &&
            "animate__animated animate__faster animate__zoomIn",
        )}
      >
        {isLoading || !item ? (
          <div className="flex-1 px-10 py-8">
            <LoadingBody />
          </div>
        ) : item.itemType === "note" ? (
          <NoteWithComments
            key={item.id}
            note={item as NoteItem}
            boardId={effectiveBoardId}
            commentsOpen={commentsOpen}
            onCommentsOpenChange={setCommentsOpen}
            onStatus={setNoteStatus}
          />
        ) : item.itemType === "excalidraw" ? (
          // Positioning context so the canvas can pin itself to fill the whole
          // pane below the header, regardless of flex sizing on lazy mount.
          <div className="relative flex min-h-0 flex-1">
            <ExcalidrawPane
              key={item.id}
              drawing={item as ExcalidrawItem}
              boardId={effectiveBoardId}
            />
          </div>
        ) : (
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
          </div>
        )}
      </div>
    </div>
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
    const embed = detectEmbed(item.url);
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

        {embed ? (
          // YouTube / Instagram render as a live embed instead of a reader view.
          <div
            className="mt-1 w-full overflow-hidden rounded-xl bg-black"
            style={{ aspectRatio: embed.aspect }}
          >
            <iframe
              src={embed.embedUrl}
              title={item.title || item.domain || "Embedded content"}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          </div>
        ) : hasArticle ? (
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
