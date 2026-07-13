import { useEffect, useRef, useState } from "react";
import { Trash2, ArrowLeft } from "lucide-react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { CustomizationPopover } from "./CustomizationPopover";
import { TagInput } from "./TagInput";
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

export function JournalItemEditor({
  item,
  standalone = false,
  onBack,
  onDeleted,
}: {
  item: JournalItem;
  // Dedicated edit page mode: full writing surface inline (no portal), no
  // full-screen toggle (the page already is one).
  standalone?: boolean;
  // Renders a back button in the header (the edit page uses it to return to the
  // day view).
  onBack?: () => void;
  onDeleted?: () => void;
}) {
  const update = useUpdateJournalItem();
  const remove = useDeleteJournalItem();

  // const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  // Style applies live; seed from the item and update instantly on change.
  const [style, setStyle] = useState<JournalStyleConfig>(item.styleConfig ?? {});
  // Tags persist immediately on each add/remove (a discrete choice, like style).
  const [tags, setTags] = useState<string[]>(item.tags ?? []);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fullscreen, setFullscreen] = useState(false);
  // Full-screen fills the content area (right of the sidebar), not the whole
  // viewport — so the sidebar stays visible. Sized to the #app-content region.
  const [_, setFsRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Track the last-persisted values so the debounce only fires on real edits.
  const savedRef = useRef({ content: item.content });
  const timerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // Debounced autosave for title/content.
  useEffect(() => {
    if (content === savedRef.current.content) {
      return;
    }
    setSaveState("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      update.mutate(
        { id: item.id, content },
        {
          onSuccess: () => {
            savedRef.current = { content };
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
  }, [content, item.id, update]);

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

  // Keep the full-screen overlay aligned to the content region so the sidebar
  // stays visible. A ResizeObserver on #app-content also catches sidebar
  // collapse/expand (which resizes the content area without a window resize).
  useEffect(() => {
    if (!fullscreen) return;
    const main = document.getElementById("app-content");
    if (!main) return;
    const update = () => {
      const r = main.getBoundingClientRect();
      setFsRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
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

  function applyTags(next: string[]) {
    setTags(next);
    update.mutate(
      { id: item.id, tags: next },
      { onError: (e) => toast.error(errMessage(e, "Could not save tags")) },
    );
  }

  function onDelete() {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    remove.mutate(item.id, {
      onSuccess: () => onDeleted?.(),
      onError: (e) => toast.error(errMessage(e, "Could not delete entry")),
    });
  }

  // Standalone (edit page) shares the expanded writing surface with fullscreen.
  const expanded = fullscreen || standalone;

  const backdrop = resolveBackdrop(style);
  const { style: bdStyle} = backdropStyle(backdrop);
  const contentFont = fontClass(style.fontKey ?? DEFAULT_FONT_KEY);

  // The item this editor holds lives in a { style } snapshot; keep the popover
  // fed with the live style.
  const liveItem: JournalItem = { ...item, styleConfig: style };

  // Header: autosave + customization + full-screen toggle + delete. Shared by
  // the inline card and the full-screen overlay.
  const header = (
    <div className="flex w-full items-center justify-between gap-2 border-b border-[var(--border)] bg-card px-4 py-2">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            title="Back"
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <ArrowLeft size={16} strokeWidth={1.5} /> Back
          </button>
        )}
        <AutosaveIndicator state={saveState} />
      </div>
      <div className="flex items-center gap-2">
        {expanded && (
          <CustomizationPopover item={liveItem} onChange={applyStyle} />
        )}
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

  const body = (
    <div
      className={cn(
        expanded ? "flex-1 h-full" : "sm:p-0",
      )}
    >
      <div
        className={cn(
          "journal-sheet text-ink-primary",
        )}
      >
        <div className={cn("journal-content py-4 bg-card", contentFont)}>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Start writing…"
            bare
            className="bg-transparent"
          />
        </div>
      </div>
    </div>
  );

  const headerBackdrop = (
    <div style={bdStyle} className="w-full h-60">

    </div>
  )

  return (
    <div className="w-full">
      {header}
      <div style={{height: '80vh'}} className="overflow-y-scroll">
        {headerBackdrop}
        <div className="mx-auto w-full max-w-[1000px]">
          <div className="px-1 pt-4">
            <TagInput value={tags} onChange={applyTags} />
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}
