import { useEditorState, type Editor } from "@tiptap/react";

/** Whitespace-separated tokens, matching the backend's wordCount for journals. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Live word count for the note, pinned to the bottom-right of the editor pane.
 *
 * Reads the editor's own text rather than parsing the saved HTML: getText()
 * walks the ProseMirror document directly, and useEditorState only re-renders
 * when the resulting number changes — so typing within a word costs nothing.
 */
export function WordCount({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor }) => countWords(editor.getText()),
  });

  if (words === 0) return null;

  return (
    <span
      // Non-interactive, and must never swallow a click meant for the last
      // line of the note underneath it.
      aria-live="off"
      className="pointer-events-none absolute bottom-3 right-4 select-none rounded-full bg-surface-primary/80 px-2 py-0.5 text-[11px] text-ink-muted backdrop-blur-sm"
    >
      {words.toLocaleString()} {words === 1 ? "word" : "words"}
    </span>
  );
}
