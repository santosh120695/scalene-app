import { useMemo, useState } from "react";
import { PenLine, NotebookPen } from "lucide-react";
import { DayCard } from "./DayCard";
import { TemplatePicker } from "./TemplatePicker";
import { JournalTagsNav } from "./JournalTagsNav";
import { JournalCalendar } from "./JournalCalendar";
import { relativeDayLabel, todayISO } from "./dates";
import { useJournalDays, useCreateJournalItem } from "@/hooks/useJournal";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";

// The journal home: last-7-days list with a prominent "write today's entry"
// action. Creating an item routes straight into its edit page; clicking
// today's card opens the day view.
export function JournalHome({
  onEnterToday,
  onOpenDay,
  onCreated,
}: {
  onEnterToday: () => void;
  // Opens a specific (past) day's entries.
  onOpenDay: (date: string) => void;
  // Called with the new item's id after a create; falls back to onEnterToday.
  onCreated?: (itemId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Fetch a wide window so the calendar can mark every day that has entries;
  // the center list still shows only the most recent handful.
  const daysQuery = useJournalDays(90);
  const create = useCreateJournalItem();

  const days = daysQuery.data ?? [];
  const recent = days.slice(0, 7);
  const markedDates = useMemo(
    () => new Set(days.map((d) => d.date)),
    [days],
  );

  // Calendar: today keeps its tz-correct entry point; other days open by date.
  function selectDate(date: string) {
    if (date === todayISO()) onEnterToday();
    else onOpenDay(date);
  }

  function writeToday(templateId: string) {
    create.mutate(
      { templateId },
      {
        onSuccess: (item) => {
          setPickerOpen(false);
          if (onCreated) onCreated(item.id);
          else onEnterToday();
        },
        onError: (e) => toast.error(errMessage(e, "Could not start entry")),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Header: title + write today's entry */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <NotebookPen size={22} strokeWidth={1.5} className="text-brand" />
          <h1 className="text-2xl font-semibold text-ink-primary">Journal</h1>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={create.isPending}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          <PenLine size={16} strokeWidth={1.5} /> Write today&apos;s entry
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start" style={{marginTop: '6rem'}}>
        {/* Left: tags to filter by */}
        <aside className="lg:w-48 lg:shrink-0">
          <JournalTagsNav />
        </aside>

        {/* Center: recent days */}
        <main className="min-w-0 flex-1">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent
          </h2>
          {daysQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-default)] p-8 text-center text-[13px] text-ink-muted">
              No entries yet. Start your first one above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recent.map((card) => {
                const isToday = relativeDayLabel(card.date) === "Today";
                return (
                  <DayCard
                    key={card.id}
                    card={card}
                    onClick={
                      isToday ? onEnterToday : () => onOpenDay(card.date)
                    }
                  />
                );
              })}
            </div>
          )}
        </main>

        {/* Right: calendar date picker */}
        <aside className="lg:w-[300px] lg:shrink-0">
          <JournalCalendar
            markedDates={markedDates}
            onSelectDate={selectDate}
          />
        </aside>
      </div>

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={writeToday}
        creating={create.isPending}
      />
    </div>
  );
}
