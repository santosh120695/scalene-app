import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved";

// Subtle autosave status shown in the item header; there is no save button.
export function AutosaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] transition-opacity",
        state === "idle" ? "opacity-0" : "opacity-100",
        state === "saving" ? "text-ink-muted" : "text-ink-secondary",
      )}
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          Saving…
        </>
      ) : state === "saved" ? (
        <>
          <Check size={12} strokeWidth={1.5} /> Saved
        </>
      ) : null}
    </span>
  );
}
