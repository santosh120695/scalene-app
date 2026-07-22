import { useState } from "react";
import { ArrowLeft, Plus} from "lucide-react";
import { JournalItemPreview } from "./JournalItemPreview";
import { TemplatePicker } from "./TemplatePicker";
import { formatDayHeading } from "./dates";
import {
  useCreateJournalItem,
} from "@/hooks/useJournal";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { JournalDay } from "@/types";

// The "new entry" placeholder — the first cell in the item grid, styled like a
// card so it reads as "add another item here".
function AddEntryCard({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ aspectRatio: "3 / 4" }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-default)] text-ink-muted transition-colors",
        "hover:border-brand/50 hover:bg-brand-light/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken transition-colors group-hover:bg-brand-light">
        <Plus size={22} strokeWidth={1.5} />
      </span>
      <span className="text-[13px] font-medium">New entry</span>
    </button>
  );
}

// The day view is a listing: each item renders as a read-only preview card;
// clicking one (or creating a new item) opens the dedicated edit page.
export function JournalDayView({
  day,
  onBack,
  onOpenItem,
  // New items always land in today's day, so the add controls only make sense
  // when viewing today. Past days are view/edit only.
  canAddItems = true,
}: {
  day: JournalDay;
  onBack: () => void;
  onOpenItem: (itemId: string) => void;
  canAddItems?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const create = useCreateJournalItem();
  // const { data: prefs } = useJournalPreferences();

  // const defaultTemplateId = prefs?.defaultTemplateId;

  function addItem(templateId: string) {
    create.mutate(
      { templateId },
      {
        // New entries go straight into the editor page.
        onSuccess: (item) => {
          setPickerOpen(false);
          onOpenItem(item.id);
        },
        onError: (e) => toast.error(errMessage(e, "Could not add entry")),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
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

      {/* Card grid — the "new entry" placeholder card comes first, then the
          item previews (same card view). */}
      <div className="grid grid-cols-1 items-start gap-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {canAddItems && (
          <AddEntryCard
            onClick={() => setPickerOpen(true)}
            disabled={create.isPending}
          />
        )}
        {day.items.map((item) => (
          <JournalItemPreview
            key={item.id}
            item={item}
            onClick={() => onOpenItem(item.id)}
          />
        ))}
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
