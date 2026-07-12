import { useState } from "react";
import { ArrowLeft, Plus, Zap } from "lucide-react";
import { JournalItemEditor } from "./JournalItemEditor";
import { TemplatePicker } from "./TemplatePicker";
import { formatDayHeading } from "./dates";
import {
  useCreateJournalItem,
  useJournalPreferences,
  useJournalTemplates,
} from "@/hooks/useJournal";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import type { JournalDay } from "@/types";

export function JournalDayView({
  day,
  onBack,
}: {
  day: JournalDay;
  onBack: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const create = useCreateJournalItem();
  const { data: prefs } = useJournalPreferences();
  const { data: templates } = useJournalTemplates();

  const defaultTemplateId = prefs?.defaultTemplateId;
  const defaultTemplate = templates?.find((t) => t.id === defaultTemplateId);

  function addItem(templateId: string) {
    create.mutate(
      { templateId },
      {
        onSuccess: () => setPickerOpen(false),
        onError: (e) => toast.error(errMessage(e, "Could not add entry")),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="All entries"
            title="All entries"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <ArrowLeft size={17} strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">
              {formatDayHeading(day.date)}
            </h1>
            <p className="text-[12px] text-ink-muted">
              {day.itemCount} {day.itemCount === 1 ? "entry" : "entries"} ·{" "}
              {day.totalWords} words
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {day.items.map((item) => (
          <JournalItemEditor key={item.id} item={item} />
        ))}
      </div>

      {/* Add another item — one-click default fast path, or the picker. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPickerOpen(true)}
          disabled={create.isPending}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary disabled:opacity-60"
        >
          <Plus size={15} strokeWidth={1.5} /> Add item
        </button>
        {defaultTemplate && (
          <button
            onClick={() => addItem(defaultTemplate.id)}
            disabled={create.isPending}
            className="flex items-center gap-1.5 rounded-md bg-brand-light px-3 py-2 text-[13px] font-medium text-brand transition-colors hover:opacity-90 disabled:opacity-60"
            title={`Use default: ${defaultTemplate.name}`}
          >
            <Zap size={14} strokeWidth={1.5} /> Use default
          </button>
        )}
      </div>

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addItem}
        creating={create.isPending}
      />
    </div>
  );
}
