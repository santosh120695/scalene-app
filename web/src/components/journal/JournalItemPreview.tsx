import {
  backdropStyle,
  fontClass,
  resolveBackdrop,
  DEFAULT_FONT_KEY,
} from "./style";
import { sanitizeHtml } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { JournalItem } from "@/types";

// Read-only preview card for one journal item, shown on the day view. Renders
// the item's own backdrop + font with a clamped excerpt of its content;
// clicking anywhere opens the dedicated edit page. A div (not a <button>)
// because the rendered content can contain checkboxes/links — pointer-events
// are disabled on it so the whole card is one click target.
export function JournalItemPreview({
  item,
  onClick,
}: {
  item: JournalItem;
  onClick: () => void;
}) {
  const style = item.styleConfig ?? {};
  const contentFont = fontClass(style.fontKey ?? DEFAULT_FONT_KEY);
  const backdrop = resolveBackdrop(style)
  const { style: bdStyle, isImage } = backdropStyle(backdrop)

  return (
    <div
      // role="button"
      tabIndex={0}
      aria-label={`Edit entry${item.title ? `: ${item.title}` : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      // Fixed 3/4 aspect ratio to match the canvas item cards (GridItem).
      style={{ width: "100%", aspectRatio: "3 / 4" }}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--border)] shadow-panel transition-colors",
        "hover:border-brand/50 focus-visible:border-brand",
        contentFont
      )}
    >
      {isImage ?
        <div style={bdStyle} className="h-20 w-full shrink-0"></div>
        :
        <div style={{ background: style.backdrop?.value || "#1e3a5f"}} className="h-20 w-full shrink-0"></div>
      }
      <div
         dangerouslySetInnerHTML={{
           __html: sanitizeHtml(item.content)
        }}
        className={cn(
           "journal-preview min-h-0 flex-1 overflow-hidden"
         )}
       />
      </div>
  );
}
