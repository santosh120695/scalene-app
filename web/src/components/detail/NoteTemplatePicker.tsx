import { FileText, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/noteTemplates";
import { cn } from "@/lib/utils";

// A tiny faux-preview of what each template scaffolds — a heading bar plus
// either body lines (standard) or checkbox rows (todos).
function TemplateMiniPreview({ template }: { template: NoteTemplate }) {
  const isTodos = template.id === "todos";
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-3">
      <div className="h-2.5 w-1/2 rounded-full bg-ink-secondary/50" />
      {isTodos ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-ink-muted/40" />
            <div className="h-1.5 flex-1 rounded-full bg-ink-muted/20" />
          </div>
        ))
      ) : (
        <>
          <div className="h-1.5 w-full rounded-full bg-ink-muted/20" />
          <div className="h-1.5 w-4/5 rounded-full bg-ink-muted/20" />
        </>
      )}
    </div>
  );
}

export function NoteTemplatePicker({
  open,
  onClose,
  onPick,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: NoteTemplate) => void;
  creating?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Start your note from a structure.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NOTE_TEMPLATES.map((t) => {
            const Icon = t.id === "todos" ? ListChecks : FileText;
            return (
              <button
                key={t.id}
                disabled={creating}
                onClick={() => onPick(t)}
                className={cn(
                  "group flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-card p-3 text-left transition-colors",
                  "hover:border-brand hover:bg-brand-light/40 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                <TemplateMiniPreview template={t} />
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-primary">
                    <Icon size={14} strokeWidth={1.5} className="text-brand" />
                    {t.name}
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {t.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
