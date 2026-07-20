import {
  FileText,
  ImageOff,
  Instagram,
  LinkIcon,
  PenTool,
  Play,
} from "lucide-react";
import type {
  AnyItem,
  ExcalidrawItem,
  ImageItem,
  LinkItem,
  NoteItem,
  PdfItem,
} from "@/types";
import { sanitizeHtml } from "@/lib/utils";
import { detectEmbed } from "@/lib/embeds";

// Renders the content area of a card based on the item's discriminated type.
export function ItemBody({ item }: { item: AnyItem }) {
  switch (item.itemType) {
    case "note":
      return <NoteBody item={item} />;
    case "link":
      return <LinkBody item={item} />;
    case "image":
      return <ImageBody item={item} />;
    case "pdf":
      return <PdfBody item={item} />;
    case "excalidraw":
      return <ExcalidrawBody item={item} />;
  }
}

function NoteBody({ item }: { item: NoteItem }) {
  if (!item.content) {
    return (
      <div className="flex-1 overflow-hidden px-3 py-2">
        <p className="text-[13px] italic text-ink-muted">Empty note</p>
      </div>
    );
  }
  return (
    <div className="relative flex-1 overflow-hidden px-3 py-2">
      <div
        className="note-preview [mask-image:linear-gradient(to_bottom,black_82%,transparent)]"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}
      />
    </div>
  );
}

function LinkBody({ item }: { item: LinkItem }) {
  const embed = detectEmbed(item.url);
  const previewSrc = item.thumbnailUrl || embed?.thumbnailUrl;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative h-[240px] w-full shrink-0 bg-surface-sunken">
        {previewSrc ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={previewSrc}
            alt={item.title || "Link preview"}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">
            {embed?.provider === "instagram" ? (
              <Instagram size={20} strokeWidth={1.5} />
            ) : (
              <LinkIcon size={20} strokeWidth={1.5} />
            )}
          </div>
        )}
        {embed?.provider === "youtube" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white shadow-md">
              <Play size={22} strokeWidth={1.5} className="translate-x-[1px] fill-white" />
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2">
        <p className="line-clamp-3 text-[12px] leading-snug text-ink-secondary">
          {item.description || item.url}
        </p>
      </div>
    </div>
  );
}

function ImageBody({ item }: { item: ImageItem }) {
  const src = item.thumbnailUrl || item.filePath;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative flex-1 bg-surface-sunken">
        {src ? (
          <img
            src={src}
            alt={item.caption || "Image"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">
            <ImageOff size={20} strokeWidth={1.5} />
          </div>
        )}
      </div>
      {item.caption && (
        <div className="shrink-0 px-3 py-1.5">
          <p className="line-clamp-1 text-[12px] text-ink-secondary">{item.caption}</p>
        </div>
      )}
    </div>
  );
}

function ExcalidrawBody({ item }: { item: ExcalidrawItem }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface-sunken px-3 py-4">
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.title || "Drawing"}
          loading="lazy"
          className="max-h-full rounded-sm object-contain shadow-item"
        />
      ) : (
        <>
          <div className="flex h-16 w-12 items-center justify-center rounded-sm border border-[var(--border)] bg-surface-primary">
            <PenTool size={22} strokeWidth={1.5} className="text-item-excalidraw" />
          </div>
          <span className="label-caps">Drawing</span>
        </>
      )}
    </div>
  );
}

function PdfBody({ item }: { item: PdfItem }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface-sunken px-3 py-4">
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title || "PDF"}
          loading="lazy"
          className="max-h-full rounded-sm object-contain shadow-item"
        />
      ) : (
        <>
          <div className="flex h-16 w-12 items-center justify-center rounded-sm border border-[var(--border)] bg-surface-primary">
            <FileText size={22} strokeWidth={1.5} className="text-item-pdf" />
          </div>
          <span className="label-caps">
            {item.pageCount ? `${item.pageCount} pages` : "PDF"}
          </span>
        </>
      )}
    </div>
  );
}
