import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISODate, todayISO } from "./dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// A compact month calendar for the journal home. Days that have entries are
// marked and clickable (→ that day's view); today is always selectable. Other
// days are shown muted and disabled (there's nothing to open).
export function JournalCalendar({
  markedDates,
  onSelectDate,
}: {
  markedDates: Set<string>;
  onSelectDate: (dateISO: string) => void;
}) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const startOffset = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d: number) => toISODate(new Date(year, month, d));
  const monthLabel = view.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-primary">
          {monthLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            onClick={() => setView(new Date(year, month - 1, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <ChevronLeft size={15} strokeWidth={1.5} />
          </button>
          <button
            aria-label="Next month"
            onClick={() => setView(new Date(year, month + 1, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <ChevronRight size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1 text-[11px] font-medium text-ink-muted">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const date = iso(d);
          const isToday = date === today;
          const marked = markedDates.has(date);
          const clickable = marked || isToday;
          return (
            <button
              key={date}
              disabled={!clickable}
              onClick={() => onSelectDate(date)}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-md text-[12px] transition-colors",
                clickable
                  ? "text-ink-primary hover:bg-surface-sunken"
                  : "cursor-default text-ink-muted/50",
                isToday && "bg-brand-light font-semibold text-brand",
              )}
            >
              {d}
              {marked && !isToday && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
