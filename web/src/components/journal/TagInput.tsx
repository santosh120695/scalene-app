import { useMemo, useState } from "react";
import { X, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useJournalTags } from "@/hooks/useJournal";
import { cn } from "@/lib/utils";

// A chip/token input for an item's tags. Current tags render as removable chips;
// typing filters a suggestion dropdown of the user's existing tags; Enter or
// comma commits the typed value. The parent persists on every change.
export function TagInput({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const { data: allTags } = useJournalTags();

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return (allTags ?? [])
      .map((t) => t.tag)
      .filter(
        (t) => !value.includes(t) && (q === "" || t.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [allTags, input, value]);

  function addTag(raw: string) {
    const t = raw.trim();
    setInput("");
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
  }

  function removeTag(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-surface-sunken px-2 py-1.5 focus-within:border-brand focus-within:bg-surface-primary">
        {value.map((t) => (
          <Badge key={t} className="bg-brand-light text-brand">
            <Hash size={11} strokeWidth={2} />
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => removeTag(t)}
              className="ml-0.5 rounded transition-colors hover:text-destructive"
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && input === "" && value.length) {
              removeTag(value[value.length - 1]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={value.length ? "" : "Add tags…"}
          className="min-w-[90px] flex-1 bg-transparent text-[13px] text-ink-primary outline-none placeholder:text-ink-muted"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-w-[240px] overflow-hidden rounded-md border border-[var(--border-default)] bg-popover p-1 shadow-panel">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              // onMouseDown (not onClick) so it fires before the input blur.
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(t);
              }}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-[13px] text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            >
              <Hash size={12} strokeWidth={1.5} /> {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
