import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  /** Pass null/undefined to render the left pane at full width with no gutter. */
  right?: ReactNode;
  /** Initial width of the left pane as a percentage (default 50). */
  initial?: number;
  /** Clamp range for the left pane width, in percent. */
  min?: number;
  max?: number;
}

// Two panes side by side separated by a draggable vertical gutter.
export function ResizableSplit({
  left,
  right,
  initial = 50,
  min = 20,
  max = 80,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [leftPct, setLeftPct] = useState(initial);

  // Below lg, stack the panes vertically — a side-by-side split is unusable
  // on narrow screens.
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(max, Math.max(min, pct)));
    }
    function stop() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [min, max]);

  function startDrag() {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // No right pane — full-width left, no gutter. Keeping this branch inside
  // ResizableSplit (rather than having callers skip the wrapper entirely)
  // keeps `left` at a stable position in the tree across split/no-split
  // transitions, so it doesn't unmount and remount.
  if (right == null) {
    return (
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-hidden">{left}</div>
      </div>
    );
  }

  // Stacked layout on narrow screens — top/bottom panes, no drag gutter.
  if (!isWide) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden border-b border-[var(--border)]">
          {left}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{right}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      <div className="min-w-0 overflow-hidden" style={{ width: `${leftPct}%` }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        onMouseDown={startDrag}
        onDoubleClick={() => setLeftPct(50)}
        className="group relative z-10 w-px shrink-0 cursor-col-resize bg-[var(--border)]"
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 transition-colors group-hover:bg-brand/30" />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
