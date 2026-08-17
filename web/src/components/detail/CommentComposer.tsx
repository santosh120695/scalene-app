import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  busy?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}

/**
 * A plain textarea, deliberately not RichTextEditor: comment bodies are short
 * prose, a TipTap instance per open composer is heavy, and a second editor
 * stealing focus is exactly the blur/save tangle the comment flow exists to
 * avoid. Content is stored as plain text and rendered with white-space:pre-wrap,
 * so it never needs sanitizing.
 */
export function CommentComposer({
  placeholder = "Add a comment…",
  submitLabel = "Comment",
  autoFocus = false,
  busy = false,
  onSubmit,
  onCancel,
}: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        rows={3}
        placeholder={placeholder}
        className="scroll-thin w-full resize-none rounded-md border border-[var(--border-default)] bg-surface-primary px-2.5 py-2 text-[13px] text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand-light"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
