import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical } from "lucide-react";
import { useRef } from "react";

// Smallest width (px) a user can shrink an image to by dragging the handle.
const MIN_WIDTH = 80;

// The interactive image: click to select (reveals a corner resize handle),
// drag the handle to resize (keeping aspect ratio), or grab the grip in the
// top-left corner to move the image up/down among the note's blocks.
//
// Movement is a custom pointer drag rather than the node's native HTML5
// `draggable`: browsers are unreliable about starting a drag from a React node
// view whose inner <img> is `draggable=false`, so grabbing the image "did
// nothing". This drives the ProseMirror transaction directly instead.
function ImageNodeView({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const width: number | null = node.attrs.width ?? null;

  // ── Resize ─────────────────────────────────────────────────────────
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = innerRef.current?.offsetWidth ?? 0;

    // Resize live by mutating the DOM width directly (cheap); commit the final
    // width to the node's attributes only on release, so we don't spam the
    // editor with a transaction — and a dirty flag — on every mouse move.
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_WIDTH, startWidth + ev.clientX - startX);
      if (innerRef.current) innerRef.current.style.width = `${next}px`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const final = innerRef.current?.offsetWidth;
      if (final) updateAttributes({ width: Math.round(final) });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  // ── Vertical move (grip handle) ────────────────────────────────────
  const startMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const view = editor.view;
    const container = view.dom.parentElement; // the .tiptap wrapper
    if (!container) return;

    let targetPos: number | null = null;
    let indicator: HTMLDivElement | null = null;

    wrapperRef.current?.classList.add("is-moving");

    const onMove = (ev: PointerEvent) => {
      const coords = view.posAtCoords({ left: ev.clientX, top: ev.clientY });
      if (!coords) return;
      const $pos = view.state.doc.resolve(coords.pos);
      if ($pos.depth < 1) return;

      // Resolve the top-level block under the pointer and decide whether to
      // drop above or below it based on the pointer's vertical position.
      const before = $pos.before(1);
      const after = $pos.after(1);
      const blockDom = view.nodeDOM(before) as HTMLElement | null;
      if (!blockDom?.getBoundingClientRect) return;
      const r = blockDom.getBoundingClientRect();
      const insertBefore = ev.clientY < r.top + r.height / 2;
      targetPos = insertBefore ? before : after;

      // Draw a thin insertion line at the chosen boundary.
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "ki-image-drop-indicator";
        container.appendChild(indicator);
      }
      const cRect = container.getBoundingClientRect();
      const y = (insertBefore ? r.top : r.bottom) - cRect.top + container.scrollTop;
      indicator.style.top = `${y}px`;
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      indicator?.remove();
      wrapperRef.current?.classList.remove("is-moving");

      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null || targetPos == null) return;
      const self = view.state.doc.nodeAt(pos);
      if (!self) return;
      // No-op if the target is the image's own slot.
      if (targetPos >= pos && targetPos <= pos + self.nodeSize) return;

      let tr = view.state.tr.delete(pos, pos + self.nodeSize);
      const insertPos = tr.mapping.map(targetPos);
      tr = tr.insert(insertPos, self);
      // Keep the moved image selected so its handles stay visible.
      try {
        tr = tr.setSelection(NodeSelection.create(tr.doc, insertPos));
      } catch {
        // insertPos may not be selectable in rare cases — ignore.
      }
      view.dispatch(tr);
      view.focus();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="ki-image"
      data-selected={selected}
    >
      <div
        ref={innerRef}
        className="ki-image-inner"
        style={{ width: width ? `${width}px` : undefined }}
      >
        <img src={node.attrs.src} alt={node.attrs.alt ?? ""} draggable={false} />
        <span
          className="ki-image-move"
          title="Drag to move"
          onPointerDown={startMove}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} strokeWidth={2} />
        </span>
        {selected && (
          <span
            className="ki-image-handle"
            onPointerDown={startResize}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

// Extends the stock Image node with a persisted `width` attribute and a React
// node view that renders the resize + move handles.
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        // Round-trips through saved note HTML as the <img width="…"> attribute.
        parseHTML: (element) => {
          const attr = element.getAttribute("width");
          if (attr) return parseInt(attr, 10) || null;
          const style = (element as HTMLElement).style?.width;
          return style ? parseInt(style, 10) || null : null;
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: attributes.width } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
