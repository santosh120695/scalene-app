import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useJournalTemplates } from "@/hooks/useJournal";
import type { JournalTemplate } from "@/types";
import { cn } from "@/lib/utils";

// A mini preview rendered from the template JSON — the same section headings
// that scaffold the item, shown as faux lines.
function TemplateMiniPreview({ template }: { template: JournalTemplate }) {
  const sections = template.template?.sections ?? [];
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-3">
      {sections.length === 0 && (
        <div className="h-1.5 w-3/4 rounded-full bg-ink-muted/25" />
      )}
      {sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {s.heading ? (
            <div className="h-2 w-1/2 rounded-full bg-ink-secondary/50" />
          ) : (
            <div className="h-1.5 w-2/3 rounded-full bg-ink-muted/25" />
          )}
          <div className="h-1.5 w-full rounded-full bg-ink-muted/20" />
        </div>
      ))}
    </div>
  );
}

export function TemplatePicker({
  open,
  onClose,
  onPick,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (templateId: string) => void;
  creating?: boolean;
}) {
  const { data: templates, isLoading } = useJournalTemplates();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Start a new entry from a structure — or a blank page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}

          {templates?.map((t) => (
            <button
              key={t.id}
              disabled={creating}
              onClick={() => onPick(t.id)}
              className={cn(
                "group flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-card p-3 text-left transition-colors",
                "hover:border-brand hover:bg-brand-light/40 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <TemplateMiniPreview template={t} />
              <span className="text-[13px] font-semibold text-ink-primary">
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
