import { FileText } from "lucide-react";
import { formatDayHeading, relativeDayLabel } from "./dates";
import type { JournalDayCard } from "@/types";
import { cn } from "@/lib/utils";

export function DayCard({
  card,
  onClick,
}: {
  card: JournalDayCard;
  onClick?: () => void;
}) {
  const relative = relativeDayLabel(card.date);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-card p-4 text-left transition-colors",
        onClick && "hover:border-brand/50 hover:bg-surface-sunken/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink-primary">
          {formatDayHeading(card.date)}
        </h3>
        {relative && (
          <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand">
            {relative}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1">
          <FileText size={13} strokeWidth={1.5} />
          {card.itemCount} {card.itemCount === 1 ? "entry" : "entries"}
        </span>
        <span>·</span>
        <span>{card.totalWords} words</span>
      </div>

      {card.latestItem && (
        <div className="mt-1 border-t border-[var(--border)] pt-2">
          {card.latestItem.title && (
            <p className="truncate text-[13px] font-medium text-ink-secondary">
              {card.latestItem.title}
            </p>
          )}
          {card.latestItem.contentPreview && (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">
              {card.latestItem.contentPreview}
            </p>
          )}
        </div>
      )}
    </Tag>
  );
}
