import type { KeyboardEvent, MouseEvent } from "react";
import { FileText, FileX2 } from "lucide-react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { NOTE_LINK_NAME, UNTITLED_NOTE, type NoteLinkOptions } from "./note-link";

export function NoteLinkNodeView({
  node,
  editor,
  selected,
  deleteNode,
}: NodeViewProps) {
  const targetId = node.attrs.targetId as string | null;
  const missing = node.attrs.missing as boolean;
  const label = (node.attrs.label as string) || UNTITLED_NOTE;

  // Read through the extension rather than a React context: the host wires a
  // ref-backed callback into the options so it survives re-renders. Deliberately
  // NOT useParams() — route params belong to the LEFT split pane, so a chip in
  // the right pane would navigate using the wrong item id.
  const options = editor.extensionManager.extensions.find(
    (e) => e.name === NOTE_LINK_NAME,
  )?.options as NoteLinkOptions | undefined;

  function open() {
    if (missing || !targetId) return;
    // Deferred: navigating synchronously inside a ProseMirror dispatch can trip
    // React's flushSync warning from TipTap's own renderer.
    queueMicrotask(() => options?.onOpen?.(targetId));
  }

  if (missing) {
    return (
      <NodeViewWrapper
        as="span"
        className="kc-note-link"
        data-note-link-missing="true"
        title="This note no longer exists"
      >
        <FileX2 size={12} strokeWidth={1.5} className="kc-note-link-icon" />
        {label}
        <button
          type="button"
          // Keeps the click from moving the caret into the editor first.
          onMouseDown={(e: MouseEvent) => e.preventDefault()}
          onClick={() => deleteNode()}
          className="kc-note-link-remove"
          aria-label="Remove broken link"
        >
          Remove
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={cn("kc-note-link")}
      data-selected={selected || undefined}
      role="link"
      tabIndex={0}
      title={label}
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={open}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <FileText size={12} strokeWidth={1.5} className="kc-note-link-icon" />
      {label}
    </NodeViewWrapper>
  );
}
