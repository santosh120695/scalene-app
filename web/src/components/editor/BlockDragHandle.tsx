import { useCallback, useMemo, useRef } from "react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  GripVertical,
  Copy,
  Eraser,
  Trash2,
  Type,
  Baseline,
  ChevronRight,
  Ban,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

// Per-line font choices. `value` is a CSS font-family applied as a TextStyle
// mark (null clears it back to the editor default).
const FONT_OPTIONS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Sans", value: "'DM Sans', sans-serif" },
  { label: "Serif", value: "'Instrument Serif', serif" },
  { label: "Mono", value: "'Fira Code', monospace" },
  { label: "Handwriting", value: "'Caveat', cursive" },
];

// Per-line text colors (null clears back to the default ink).
const COLOR_OPTIONS: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Gray", value: "#787774" },
  { label: "Red", value: "#e03e3e" },
  { label: "Orange", value: "#d9730d" },
  { label: "Yellow", value: "#cb9433" },
  { label: "Green", value: "#4d9a06" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
];

// A Notion-style drag handle that appears to the left of the hovered block. Drag
// it to reorder blocks; click it for a context menu of block actions: change the
// line's font or text color, duplicate, clear formatting, or delete. Only
// mounted on the full editor (not the compact sub-note composer).
export function BlockDragHandle({ editor }: { editor: Editor }) {
  // The block currently under the handle, tracked from the plugin so the menu
  // acts on the right node even though the handle floats outside the doc.
  const nodeRef = useRef<{ node: PMNode | null; pos: number }>({
    node: null,
    pos: 0,
  });

  const onNodeChange = useCallback(
    (data: { node: PMNode | null; pos: number }) => {
      nodeRef.current = { node: data.node, pos: data.pos };
    },
    [],
  );

  // v3 positions the handle with Floating UI. Must be a stable reference or the
  // handle re-initializes on every render (per the extension's docs).
  const computePositionConfig = useMemo(
    () => ({ placement: "left" as const }),
    [],
  );

  // The text range covering the current block's content (inside its boundaries),
  // so marks apply to the whole line regardless of the cursor position.
  const blockRange = useCallback(() => {
    const { pos } = nodeRef.current;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return null;
    return { from: pos + 1, to: pos + node.nodeSize - 1 };
  }, [editor]);

  const setBlockFont = useCallback(
    (value: string | null) => {
      const range = blockRange();
      if (!range) return;
      const chain = editor.chain().focus().setTextSelection(range);
      (value ? chain.setFontFamily(value) : chain.unsetFontFamily()).run();
    },
    [editor, blockRange],
  );

  const setBlockColor = useCallback(
    (value: string | null) => {
      const range = blockRange();
      if (!range) return;
      const chain = editor.chain().focus().setTextSelection(range);
      (value ? chain.setColor(value) : chain.unsetColor()).run();
    },
    [editor, blockRange],
  );

  const duplicateBlock = useCallback(() => {
    const { pos } = nodeRef.current;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
  }, [editor]);

  const clearFormatting = useCallback(() => {
    const range = blockRange();
    if (!range) return;
    editor
      .chain()
      .focus()
      .setTextSelection(range)
      .unsetAllMarks()
      .setParagraph()
      .run();
  }, [editor, blockRange]);

  const deleteBlock = useCallback(() => {
    const { pos } = nodeRef.current;
    editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
  }, [editor]);

  return (
    <DragHandle
      editor={editor}
      onNodeChange={onNodeChange}
      computePositionConfig={computePositionConfig}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Block options"
            title="Drag to move · click for options"
            className="flex h-6 w-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink-secondary"
          >
            <GripVertical size={16} strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-44">
          {/* Font submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Type size={14} strokeWidth={1.5} /> Font
              <ChevronRight size={14} strokeWidth={1.5} className="ml-auto" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {FONT_OPTIONS.map((f) => (
                <DropdownMenuItem
                  key={f.label}
                  onClick={() => setBlockFont(f.value)}
                  style={f.value ? { fontFamily: f.value } : undefined}
                >
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Text color submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Baseline size={14} strokeWidth={1.5} /> Color
              <ChevronRight size={14} strokeWidth={1.5} className="ml-auto" />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {COLOR_OPTIONS.map((c) => (
                <DropdownMenuItem
                  key={c.label}
                  onClick={() => setBlockColor(c.value)}
                >
                  {c.value ? (
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
                      style={{ backgroundColor: c.value }}
                    />
                  ) : (
                    <Ban size={14} strokeWidth={1.5} className="text-ink-muted" />
                  )}
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={duplicateBlock}>
            <Copy size={14} strokeWidth={1.5} /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={clearFormatting}>
            <Eraser size={14} strokeWidth={1.5} /> Clear formatting
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={deleteBlock}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 size={14} strokeWidth={1.5} /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DragHandle>
  );
}
