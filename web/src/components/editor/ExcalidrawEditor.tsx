import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { Eraser, Pen, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A freehand drawing is stored as a list of strokes; each stroke is a series of
// [x, y] points in logical canvas coordinates plus its color and size. This
// reuses the existing `sceneData.elements` field so the item model, API, and
// thumbnail contract are unchanged from the previous Excalidraw editor.
interface Stroke {
  points: number[][];
  color: string;
  size: number;
}

interface SceneData {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
}

interface Props {
  initialData?: SceneData;
  onSave: (data: { sceneData: SceneData; thumbnail: string }) => void;
}

const AUTOSAVE_DELAY_MS = 800;

const COLORS = [
  "#1f2937", // ink
  "#dc2626", // red
  "#f59e0b", // amber
  "#059669", // brand green
  "#2563eb", // blue
  "#db2777", // drawing accent
];
const SIZES = [4, 8, 16];
const ERASE_RADIUS = 12;
// Palm rejection: once a stylus (Apple Pencil → pointerType "pen") is in use,
// ignore finger/palm touches while it's down and for a short grace window after
// each pen stroke, so a hand resting on an iPad doesn't leave stray marks.
const PALM_GRACE_MS = 1000;
const STROKE_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
} as const;

function isStroke(v: unknown): v is Stroke {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as Stroke).points) &&
    typeof (v as Stroke).color === "string" &&
    typeof (v as Stroke).size === "number"
  );
}

// Turn a stroke's input points into a filled outline path via perfect-freehand.
function strokePath(stroke: Stroke): Path2D | null {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    ...STROKE_OPTIONS,
  });
  if (outline.length === 0) return null;
  const path = new Path2D();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const path = strokePath(stroke);
  if (!path) return;
  ctx.fillStyle = stroke.color;
  ctx.fill(path);
}

// Render the strokes into a 400×300 PNG, scaled to fit their bounding box —
// the same thumbnail size the cards expect.
function makeThumbnail(strokes: Stroke[]): string {
  if (strokes.length === 0) return "";
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return "";

  const W = 400,
    H = 300,
    pad = 24;
  const cw = maxX - minX || 1;
  const ch = maxY - minY || 1;
  const scale = Math.min((W - pad * 2) / cw, (H - pad * 2) / ch, 4);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.translate((W - cw * scale) / 2 - minX * scale, (H - ch * scale) / 2 - minY * scale);
  ctx.scale(scale, scale);
  for (const s of strokes) drawStroke(ctx, s);
  return canvas.toDataURL("image/png");
}

// Full-page freehand drawing canvas with debounced autosave — the perfect-
// freehand replacement for the old Excalidraw editor. Keeps the same props so
// ItemDetailView's drawing pane needs no changes.
export function ExcalidrawEditor({ initialData, onSave }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>(() =>
    (initialData?.elements ?? []).filter(isStroke),
  );
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = useRef<Stroke | null>(null);
  const drawing = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const penDown = useRef(false);
  const lastPenAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  // Latest strokes for the debounced save closure and pointer handlers.
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const list = strokesRef.current;
      onSave({
        sceneData: { elements: list, appState: {} },
        thumbnail: makeThumbnail(list),
      });
    }, AUTOSAVE_DELAY_MS);
  }, [onSave]);

  // Repaint the whole canvas (committed strokes + the in-progress one).
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (current.current) drawStroke(ctx, current.current);
  }, []);

  // Keep the canvas backing store sized to its container (device-pixel aware).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = `${wrap.clientHeight}px`;
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function pointAt(e: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function eraseAt(pt: [number, number]) {
    setStrokes((prev) => {
      const next = prev.filter(
        (s) =>
          !s.points.some(
            ([x, y]) => Math.hypot(x - pt[0], y - pt[1]) <= ERASE_RADIUS + s.size / 2,
          ),
      );
      if (next.length !== prev.length) scheduleSave();
      return next;
    });
  }

  // True when a finger/palm touch should be ignored because a stylus is in use.
  function isPalm(e: React.PointerEvent): boolean {
    if (e.pointerType !== "touch") return false;
    return penDown.current || Date.now() - lastPenAt.current < PALM_GRACE_MS;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "pen") {
      penDown.current = true;
      lastPenAt.current = Date.now();
    }
    // Reject palm touches, and ignore extra pointers while a stroke is active.
    if (isPalm(e) || drawing.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    drawing.current = true;
    const pt = pointAt(e);
    if (erasing) {
      eraseAt(pt);
      return;
    }
    current.current = { points: [pt], color, size };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "pen") lastPenAt.current = Date.now();
    if (!drawing.current || e.pointerId !== activePointerId.current) return;
    const pt = pointAt(e);
    if (erasing) {
      eraseAt(pt);
      return;
    }
    current.current?.points.push(pt);
    redraw();
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType === "pen") {
      penDown.current = false;
      lastPenAt.current = Date.now();
    }
    if (!drawing.current || e.pointerId !== activePointerId.current) return;
    drawing.current = false;
    activePointerId.current = null;
    if (erasing) return;
    const stroke = current.current;
    current.current = null;
    // Drop degenerate taps that produced no real line.
    if (stroke && stroke.points.length > 1) {
      setStrokes((prev) => [...prev, stroke]);
      scheduleSave();
    } else {
      redraw();
    }
  }

  function undo() {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      scheduleSave();
      return prev.slice(0, -1);
    });
  }

  function clear() {
    if (strokes.length === 0) return;
    setStrokes([]);
    scheduleSave();
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-card px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setErasing(false)}
            aria-label="Pen"
            title="Pen"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken",
              !erasing && "bg-brand-light text-brand",
            )}
          >
            <Pen size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setErasing(true)}
            aria-label="Eraser"
            title="Eraser"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken",
              erasing && "bg-brand-light text-brand",
            )}
          >
            <Eraser size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              aria-label={`Color ${c}`}
              style={{ backgroundColor: c }}
              className={cn(
                "h-5 w-5 rounded-full ring-offset-2 ring-offset-card transition-shadow",
                color === c && !erasing && "ring-2 ring-brand",
              )}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Sizes */}
        <div className="flex items-center gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              aria-label={`Size ${s}`}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-surface-sunken",
                size === s && "bg-surface-sunken",
              )}
            >
              <span
                className="rounded-full bg-ink-primary"
                style={{ width: s, height: s }}
              />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            aria-label="Undo"
            title="Undo"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken disabled:opacity-40"
          >
            <Undo2 size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            aria-label="Clear"
            title="Clear"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken disabled:opacity-40"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="min-h-0 flex-1 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "block touch-none",
            erasing ? "cursor-cell" : "cursor-crosshair",
          )}
        />
      </div>
    </div>
  );
}
