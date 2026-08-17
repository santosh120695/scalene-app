import { useState } from "react";
import { Check, CornerDownRight, Trash2, Undo2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommentComposer } from "@/components/detail/CommentComposer";
import { cn, timeAgo } from "@/lib/utils";
import type { CommentThreadGroup, NoteComment } from "@/types";

function CommentRow({
  comment,
  onDelete,
}: {
  comment: NoteComment;
  onDelete: (id: string) => void;
}) {
  const who = comment.authorName || comment.authorEmail || "You";
  return (
    <div className="group flex gap-2.5">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className="text-[10px]">
          {who.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12px] font-medium text-ink-primary">{who}</span>
          <span className="shrink-0 text-[11px] text-ink-muted">{timeAgo(comment.createdAt)}</span>
          <button
            onClick={() => onDelete(comment.id)}
            aria-label="Delete comment"
            className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 size={13} strokeWidth={1.5} className="text-ink-muted hover:text-destructive" />
          </button>
        </div>
        {/* Plain text, so React's own escaping is the whole sanitization story. */}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-ink-secondary">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

interface Props {
  thread: CommentThreadGroup;
  active: boolean;
  busy?: boolean;
  onFocus: (anchorId: string) => void;
  onReply: (anchorId: string, text: string) => void;
  onDelete: (id: string) => void;
  onResolve: (rootId: string, resolved: boolean) => void;
}

export function CommentThread({
  thread,
  active,
  busy,
  onFocus,
  onReply,
  onDelete,
  onResolve,
}: Props) {
  const [replying, setReplying] = useState(false);
  const resolved = !!thread.resolvedAt;

  return (
    <div
      onClick={() => onFocus(thread.anchorId)}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-colors",
        active
          ? "border-brand bg-brand-light/40"
          : "border-[var(--border)] bg-surface-primary hover:border-[var(--border-strong)]",
        resolved && "opacity-70"
      )}
    >
      {/* The passage this thread is about, snapshotted when it was created. */}
      {thread.quotedText && (
        <blockquote
          className={cn(
            "mb-2 border-l-2 pl-2 text-[12px] italic text-ink-muted",
            thread.detached ? "border-[var(--border-strong)] line-through" : "border-brand"
          )}
        >
          {thread.quotedText}
        </blockquote>
      )}

      <div className="flex flex-col gap-3">
        <CommentRow comment={thread.root} onDelete={onDelete} />
        {thread.replies.map((reply) => (
          <div key={reply.id} className="pl-4">
            <CommentRow comment={reply} onDelete={onDelete} />
          </div>
        ))}
      </div>

      <div
        className="mt-2 flex items-center gap-1"
        // The composer and these buttons live inside the card's click target.
        onClick={(e) => e.stopPropagation()}
      >
        {!replying && !resolved && (
          <button
            onClick={() => setReplying(true)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            <CornerDownRight size={12} strokeWidth={1.5} /> Reply
          </button>
        )}
        <button
          onClick={() => onResolve(thread.root.id, !resolved)}
          disabled={busy}
          className={cn(
            "ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-[12px] transition-colors",
            resolved
              ? "text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary"
              : "text-ink-secondary hover:bg-surface-sunken hover:text-brand"
          )}
        >
          {resolved ? (
            <>
              <Undo2 size={12} strokeWidth={1.5} /> Reopen
            </>
          ) : (
            <>
              <Check size={12} strokeWidth={1.5} /> Resolve
            </>
          )}
        </button>
      </div>

      {replying && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <CommentComposer
            autoFocus
            busy={busy}
            placeholder="Reply…"
            submitLabel="Reply"
            onSubmit={(text) => {
              onReply(thread.anchorId, text);
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}
