import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as commentsApi from "@/api/comments";
import type { CommentThreadGroup, NoteComment } from "@/types";

export const commentKeys = {
  list: (itemId: string) => ["comments", itemId] as const,
};

export function useCommentsList(itemId: string, enabled = true) {
  return useQuery({
    queryKey: commentKeys.list(itemId),
    queryFn: () => commentsApi.listComments(itemId),
    enabled: enabled && !!itemId,
  });
}

export function useCreateComment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: commentsApi.CreateCommentInput) =>
      commentsApi.createComment(itemId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.list(itemId) }),
  });
}

export function useUpdateComment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; content: string }) =>
      commentsApi.updateComment(vars.id, vars.content),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.list(itemId) }),
  });
}

export function useDeleteComment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.list(itemId) }),
  });
}

// Optimistic so the highlight fades the instant you click, matching useToggleTodo.
export function useResolveComment(itemId: string) {
  const qc = useQueryClient();
  const key = commentKeys.list(itemId);
  return useMutation({
    mutationFn: (vars: { id: string; resolved: boolean }) =>
      commentsApi.resolveComment(vars.id, vars.resolved),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<NoteComment[]>(key);
      qc.setQueryData<NoteComment[]>(key, (old) =>
        old?.map((c) =>
          c.id === vars.id
            ? { ...c, resolvedAt: vars.resolved ? new Date().toISOString() : null }
            : c
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Groups a flat comment list into threads, ordered to match the note.
 *
 * `anchorOrder` is the list of anchor ids as they appear in the document (see
 * anchorIdsInDoc in components/editor/comment-mark). Threads whose anchor is
 * absent from it are detached — their highlighted text was deleted — and sort
 * to the end. Kept as a plain function so it is testable without an editor.
 */
export function groupThreads(
  comments: NoteComment[],
  anchorOrder: string[]
): CommentThreadGroup[] {
  const byAnchor = new Map<string, NoteComment[]>();
  for (const c of comments) {
    const bucket = byAnchor.get(c.anchorId);
    if (bucket) bucket.push(c);
    else byAnchor.set(c.anchorId, [c]);
  }

  const groups: CommentThreadGroup[] = [];
  for (const [anchorId, rows] of byAnchor) {
    const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // A thread with no root row is unreachable (the root's delete takes the
    // whole thread), but guard rather than render a half-thread.
    const root = sorted.find((c) => c.isThreadRoot) ?? sorted[0];
    if (!root) continue;
    groups.push({
      anchorId,
      quotedText: root.quotedText,
      root,
      replies: sorted.filter((c) => c.id !== root.id),
      resolvedAt: root.resolvedAt,
      detached: !anchorOrder.includes(anchorId),
    });
  }

  return groups.sort((a, b) => {
    const ai = anchorOrder.indexOf(a.anchorId);
    const bi = anchorOrder.indexOf(b.anchorId);
    if (ai === bi) return a.root.createdAt.localeCompare(b.root.createdAt);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
