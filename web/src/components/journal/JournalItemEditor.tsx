import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, Maximize2, Minimize2 } from "lucide-react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { CustomizationPopover } from "./CustomizationPopover";
import { AutosaveIndicator, type SaveState } from "./AutosaveIndicator";
import {
  backdropStyle,
  fontClass,
  resolveBackdrop,
  DEFAULT_FONT_KEY,
} from "./style";
import { useUpdateJournalItem, useDeleteJournalItem } from "@/hooks/useJournal";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { JournalItem, JournalStyleConfig } from "@/types";

const AUTOSAVE_MS = 1500;

export function JournalItemEditor({ item }: { item: JournalItem }) {
  const update = useUpdateJournalItem();
  const remove = useDeleteJournalItem();

  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  // Style applies live; seed from the item and update instantly on change.
  const [style, setStyle] = useState<JournalStyleConfig>(item.styleConfig ?? {});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fullscreen, setFullscreen] = useState(false);

  // Track the last-persisted values so the debounce only fires on real edits.
  const savedRef = useRef({ title: item.title, content: item.content });
  const timerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // Debounced autosave for title/content.
  useEffect(() => {
    if (title === savedRef.current.title && content === savedRef.current.content) {
      return;
    }
    setSaveState("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      update.mutate(
        { id: item.id, title, content },
        {
          onSuccess: () => {
            savedRef.current = { title, content };
            setSaveState("saved");
            if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
            savedTimerRef.current = window.setTimeout(
              () => setSaveState("idle"),
              2000,
            );
          },
          onError: (e) => {
            setSaveState("idle");
            toast.error(errMessage(e, "Could not save"));
          },
        },
      );
    }, AUTOSAVE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [title, content, item.id, update]);

  // In full-screen focus mode, lock body scroll and let Esc exit. (The Esc
  // handler runs at capture but only acts when no popover is open, so pressing
  // Esc with the customization popover open closes the popover first.)
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-journal-popover]")) return;
      setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // Style changes persist immediately (a discrete choice, not typing).
  function applyStyle(next: JournalStyleConfig) {
    setStyle(next);
    update.mutate(
      { id: item.id, styleConfig: next },
      { onError: (e) => toast.error(errMessage(e, "Could not save style")) },
    );
  }

  function onDelete() {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    remove.mutate(item.id, {
      onError: (e) => toast.error(errMessage(e, "Could not delete entry")),
    });
  }

  const backdrop = resolveBackdrop(style);
  const { style: bdStyle, isImage } = backdropStyle(backdrop);
  const contentFont = fontClass(style.fontKey ?? DEFAULT_FONT_KEY);

  // The item this editor holds lives in a { style } snapshot; keep the popover
  // fed with the live style.
  const liveItem: JournalItem = { ...item, styleConfig: style };

  // Header: autosave + customization + full-screen toggle + delete. Shared by
  // the inline card and the full-screen overlay.
  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-card px-4 py-2">
      <AutosaveIndicator state={saveState} />
      <div className="flex items-center gap-2">
        <CustomizationPopover item={liveItem} onChange={applyStyle} />
        <button
          onClick={() => setFullscreen((f) => !f)}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink-primary"
        >
          {fullscreen ? (
            <Minimize2 size={15} strokeWidth={1.5} />
          ) : (
            <Maximize2 size={15} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete entry"
          title="Delete entry"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  // Writing surface — backdrop behind, a translucent sheet over images. Grows to
  // fill the viewport in full-screen mode.
  const body = (
    <div
      style={bdStyle}
      className={cn(
        fullscreen ? "flex-1 overflow-y-auto p-4 sm:p-10" : "p-4 sm:p-8",
      )}
    >
      <div
        className={cn(
          "journal-sheet mx-auto rounded-lg px-5 py-5 sm:px-8",
          fullscreen ? "max-w-3xl" : "max-w-2xl",
          isImage ? "bg-white/85 shadow-sm backdrop-blur-sm" : "bg-transparent",
        )}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className={cn(
            "w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-ink-muted/50",
            contentFont,
          )}
        />
        <div className={cn("journal-content mt-3", contentFont)}>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Start writing…"
            bare
            minHeight={fullscreen ? 480 : 200}
            // Override the shared editor's opaque bg so the backdrop (tint or
            // image) shows through behind the writing, not just around it.
            className="bg-transparent"
          />
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-page">
        {header}
        {body}
      </div>,
      document.body,
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] shadow-panel">
      {header}
      {body}
    </div>
  );
}
