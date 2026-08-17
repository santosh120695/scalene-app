import { useEffect, useRef } from "react";
import { MessageSquare, Unlink, X } from "lucide-react";
import { CommentComposer } from "@/components/detail/CommentComposer";
import { CommentThread } from "@/components/detail/CommentThread";
import { cn } from "@/lib/utils";
import type { CommentThreadGroup } from "@/types";

export interface PendingThread {
  quotedText: string;
}

interface Props {
  open: boolean;
  threads: CommentThreadGroup[];
  activeAnchorId: string | null;
  pending: PendingThread | null;
  showResolved: boolean;
  busy?: boolean;
  // An anchor was clicked in the note but no thread matches it — a highlight
  // left behind by a comment deleted elsewhere.
  orphanAnchorId: string | null;
  onClose: () => void;
  onToggleResolved: () => void;
  onFocusThread: (anchorId: string) => void;
  onSubmitPending: (text: string) => void;
  onCancelPending: () => void;
  onReply: (anchorId: string, text: string) => void;
  onDelete: (id: string) => void;
  onResolve: (rootId: string, resolved: boolean) => void;
  onRemoveOrphanHighlight: (anchorId: string) => void;
}

export function CommentsDrawer({
  open,
  threads,
  activeAnchorId,
  pending,
  showResolved,
  busy,
  orphanAnchorId,
  onClose,
  onToggleResolved,
  onFocusThread,
  onSubmitPending,
  onCancelPending,
  onReply,
  onDelete,
  onResolve,
  onRemoveOrphanHighlight,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Bring the focused thread into view when a highlight is clicked in the note.
  useEffect(() => {
    if (!open || !activeAnchorId) return;
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, activeAnchorId]);

  const attached = threads.filter((t) => !t.detached);
  const detached = threads.filter((t) => t.detached);
  const visible = showResolved ? attached : attached.filter((t) => !t.resolvedAt);
  const resolvedCount = attached.filter((t) => t.resolvedAt).length;

  return (
    <aside
      data-open={open}
      aria-hidden={!open}
      className={cn(
        "comments-drawer shrink-0 border-[var(--border)] bg-surface-primary",
        // Below md a 400px push panel would leave nothing of the note, so it
        // becomes a full-width sheet over the content instead.
        "fixed inset-x-0 bottom-0 top-12 z-30 border-l-0 border-t",
        "md:static md:inset-auto md:z-auto md:border-l md:border-t-0",
        !open && "pointer-events-none"
      )}
    >
      <div className="comments-drawer-inner flex h-full flex-col">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-surface-primary px-4">
          <MessageSquare size={14} strokeWidth={1.5} className="text-ink-secondary" />
          <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
            Comments ({attached.length})
          </span>
          {resolvedCount > 0 && (
            <button
              onClick={onToggleResolved}
              className={cn(
                "rounded px-1.5 py-1 text-[11px] transition-colors hover:bg-surface-sunken",
                showResolved ? "text-brand" : "text-ink-secondary"
              )}
            >
              {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close comments"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </header>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {/* A thread being written: the row does not exist yet, and neither
              does the highlight — only a pending decoration in the editor. */}
          {pending && (
            <div className="rounded-lg border border-brand bg-brand-light/40 p-3">
              {pending.quotedText && (
                <blockquote className="mb-2 border-l-2 border-brand pl-2 text-[12px] italic text-ink-muted">
                  {pending.quotedText}
                </blockquote>
              )}
              <CommentComposer
                autoFocus
                busy={busy}
                onSubmit={onSubmitPending}
                onCancel={onCancelPending}
              />
            </div>
          )}

          {orphanAnchorId && (
            <div className="rounded-lg border border-[var(--border-strong)] bg-surface-sunken p-3">
              <p className="text-[12px] text-ink-secondary">
                This highlight has no comment — it was probably deleted elsewhere.
              </p>
              <button
                onClick={() => onRemoveOrphanHighlight(orphanAnchorId)}
                className="mt-2 flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-ink-secondary transition-colors hover:bg-surface-primary hover:text-ink-primary"
              >
                <Unlink size={12} strokeWidth={1.5} /> Remove highlight
              </button>
            </div>
          )}

          {visible.map((thread) => (
            <div
              key={thread.anchorId}
              ref={thread.anchorId === activeAnchorId ? activeRef : undefined}
            >
              <CommentThread
                thread={thread}
                active={thread.anchorId === activeAnchorId}
                busy={busy}
                onFocus={onFocusThread}
                onReply={onReply}
                onDelete={onDelete}
                onResolve={onResolve}
              />
            </div>
          ))}

          {!pending && visible.length === 0 && !orphanAnchorId && (
            <div className="flex flex-col gap-1 py-6 text-center">
              <p className="text-[13px] text-ink-secondary">No comments yet.</p>
              <p className="text-[12px] text-ink-muted">
                Select text in the note and choose Comment.
              </p>
            </div>
          )}

          {/* Threads whose highlighted text was deleted. Never auto-removed —
              a transient empty document would otherwise destroy real threads. */}
          {detached.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              <span className="label-caps text-ink-muted">Detached ({detached.length})</span>
              {detached.map((thread) => (
                <CommentThread
                  key={thread.anchorId}
                  thread={thread}
                  active={thread.anchorId === activeAnchorId}
                  busy={busy}
                  onFocus={onFocusThread}
                  onReply={onReply}
                  onDelete={onDelete}
                  onResolve={onResolve}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
