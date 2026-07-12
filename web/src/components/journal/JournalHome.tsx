import { useState } from "react";
import { PenLine, Zap, NotebookPen } from "lucide-react";
import { DayCard } from "./DayCard";
import { TemplatePicker } from "./TemplatePicker";
import { relativeDayLabel } from "./dates";
import {
  useJournalDays,
  useCreateJournalItem,
  useJournalPreferences,
  useJournalTemplates,
} from "@/hooks/useJournal";
import { Skeleton } from "@/components/ui/skeleton";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";

// The journal home: last-7-days list with a prominent "write today's entry"
// action. Creating today's first item routes into the day view.
export function JournalHome({
  onEnterToday,
}: {
  onEnterToday: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const daysQuery = useJournalDays(7);
  const create = useCreateJournalItem();
  const { data: prefs } = useJournalPreferences();
  const { data: templates } = useJournalTemplates();

  const days = daysQuery.data ?? [];
  const defaultTemplate = templates?.find(
    (t) => t.id === prefs?.defaultTemplateId,
  );

  function writeToday(templateId: string) {
    create.mutate(
      { templateId },
      {
        onSuccess: () => {
          setPickerOpen(false);
          onEnterToday();
        },
        onError: (e) => toast.error(errMessage(e, "Could not start entry")),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2.5">
        <NotebookPen size={22} strokeWidth={1.5} className="text-brand" />
        <h1 className="text-2xl font-semibold text-ink-primary">Journal</h1>
      </div>

      {/* Write today's entry */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPickerOpen(true)}
          disabled={create.isPending}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          <PenLine size={16} strokeWidth={1.5} /> Write today&apos;s entry
        </button>
        {defaultTemplate && (
          <button
            onClick={() => writeToday(defaultTemplate.id)}
            disabled={create.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-brand-light px-3 py-2.5 text-[13px] font-medium text-brand transition-colors hover:opacity-90 disabled:opacity-60"
            title={`Use default: ${defaultTemplate.name}`}
          >
            <Zap size={14} strokeWidth={1.5} /> Use default
          </button>
        )}
      </div>

      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
        Last 7 days
      </h2>

      {daysQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-default)] p-8 text-center text-[13px] text-ink-muted">
          No entries yet. Start your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((card) => {
            const isToday = relativeDayLabel(card.date) === "Today";
            return (
              <DayCard
                key={card.id}
                card={card}
                onClick={isToday ? onEnterToday : undefined}
              />
            );
          })}
        </div>
      )}

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={writeToday}
        creating={create.isPending}
      />
    </div>
  );
}
