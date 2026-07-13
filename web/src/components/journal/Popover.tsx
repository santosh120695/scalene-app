import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// A minimal popover: an anchored panel with click-outside + Esc to close.
// Built from primitives rather than pulling in @radix-ui/react-popover, to keep
// Tiptap the only new dependency (deviation from the spec's shadcn Popover,
// noted in the handoff).
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "end",
  className,
}: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    // Defer so the same click that opened it doesn't immediately close it.
    const id = window.setTimeout(
      () => document.addEventListener("mousedown", onClick),
      0,
    );
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          data-journal-popover
          className={cn(
            "absolute z-40 mt-2 rounded-lg border border-[var(--border-default)] bg-popover p-3 shadow-panel",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
