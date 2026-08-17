import { Mark, mergeAttributes, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const COMMENT_MARK_NAME = "comment";

export interface CommentPluginState {
  // Anchor id of the thread currently focused in the drawer.
  active: string | null;
  // Anchor ids whose thread is resolved (rendered faded).
  resolved: string[];
  // The range a not-yet-submitted comment is being written about. This is a
  // decoration, never a mark — see the comment on setPendingComment.
  pending: { from: number; to: number } | null;
}

export const commentPluginKey = new PluginKey<CommentPluginState>("commentMark");

export interface CommentMarkOptions {
  // Fired when the reader clicks inside a highlight. Pass a ref-backed
  // indirection: this is captured once at editor-creation time.
  onAnchorClick: ((anchorId: string) => void) | null;
}

interface CommentMeta {
  active?: string | null;
  resolved?: string[];
  pending?: { from: number; to: number } | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: () => ReturnType;
      unsetCommentById: (commentId: string) => ReturnType;
      setPendingComment: (from: number, to: number) => ReturnType;
      clearPendingComment: () => ReturnType;
      setActiveComment: (anchorId: string | null) => ReturnType;
      setResolvedComments: (anchorIds: string[]) => ReturnType;
    };
  }
}

/** Every comment anchor id present in the document, in document order. */
export function anchorIdsInDoc(editor: Editor): string[] {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    for (const mark of node.marks) {
      const id = mark.type.name === COMMENT_MARK_NAME ? (mark.attrs.commentId as string) : null;
      if (id && !ids.includes(id)) ids.push(id);
    }
  });
  return ids;
}

/** True when any part of [from,to) already carries a comment mark. */
export function rangeHasComment(editor: Editor, from: number, to: number): boolean {
  let found = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    if (node.marks.some((m) => m.type.name === COMMENT_MARK_NAME)) found = true;
    return true;
  });
  return found;
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: COMMENT_MARK_NAME,

  addOptions() {
    return { onAnchorClick: null };
  },

  // ProseMirror marks default to inclusive: true, which silently *extends* a
  // highlight when you place the caret at its edge and type — the anchor's text
  // would drift away from the quoted passage stored server-side with no
  // affordance saying so. A comment range only changes by explicit re-selection.
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        // Deliberately no keepOnSplit:false (unlike TaskItemWithId's todoId):
        // splitting a highlighted paragraph with Enter should keep both halves
        // in the same thread.
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-comment-id"),
        renderHTML: (attrs) =>
          attrs.commentId ? { "data-comment-id": attrs.commentId } : {},
      },
    };
  },

  parseHTML() {
    // Attribute-gated, so a plain <mark> pasted from a web page is not adopted
    // as a comment anchor.
    return [{ tag: "mark[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes, { class: "kc-comment" }), 0];
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),

      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      // Strips one anchor's highlight wherever it appears. Needed because by the
      // time a highlight must go (thread deleted, orphan cleanup) the selection
      // is long gone, so unsetMark-on-selection is useless.
      unsetCommentById:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          // Collect first, dispatch once — removing as we walk would shift the
          // positions still to be visited.
          const ranges: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return true;
            if (node.marks.some((m) => m.type === markType && m.attrs.commentId === commentId)) {
              ranges.push({ from: pos, to: pos + node.nodeSize });
            }
            return true;
          });
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const r of ranges) tr.removeMark(r.from, r.to, markType);
          }
          return true;
        },

      // The four commands below dispatch meta-only transactions: no document
      // change, so they never dirty the note and never trigger a save. That is
      // the whole reason pending/active/resolved live here as decorations
      // rather than as mark attributes — putting `resolved` on the mark would
      // make every resolve click rewrite the note HTML.
      setPendingComment:
        (from, to) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(commentPluginKey, { pending: { from, to } } as CommentMeta));
          return true;
        },

      clearPendingComment:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(commentPluginKey, { pending: null } as CommentMeta));
          return true;
        },

      setActiveComment:
        (anchorId) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(commentPluginKey, { active: anchorId } as CommentMeta));
          return true;
        },

      setResolvedComments:
        (anchorIds) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(commentPluginKey, { resolved: anchorIds } as CommentMeta));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const markName = this.name;

    return [
      new Plugin<CommentPluginState>({
        key: commentPluginKey,

        state: {
          init: () => ({ active: null, resolved: [], pending: null }),
          apply(tr, prev) {
            const meta = tr.getMeta(commentPluginKey) as CommentMeta | undefined;
            // Map the pending range through the transaction so it self-heals
            // while the user keeps typing with the composer open. This is what
            // makes deferring the mark until after the POST safe.
            const mapped = prev.pending
              ? { from: tr.mapping.map(prev.pending.from), to: tr.mapping.map(prev.pending.to) }
              : null;
            return {
              active: meta && "active" in meta ? meta.active! : prev.active,
              resolved: meta?.resolved ?? prev.resolved,
              pending: meta && "pending" in meta ? meta.pending! : mapped,
            };
          },
        },

        props: {
          decorations(state) {
            const pluginState = commentPluginKey.getState(state);
            if (!pluginState) return DecorationSet.empty;
            const { active, resolved, pending } = pluginState;
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (!node.isText) return true;
              for (const mark of node.marks) {
                if (mark.type.name !== markName) continue;
                const id = mark.attrs.commentId as string | null;
                if (!id) continue;
                const classes: string[] = [];
                if (id === active) classes.push("kc-comment--active");
                if (resolved.includes(id)) classes.push("kc-comment--resolved");
                if (classes.length > 0) {
                  decorations.push(
                    Decoration.inline(pos, pos + node.nodeSize, { class: classes.join(" ") })
                  );
                }
              }
              return true;
            });

            if (pending && pending.to > pending.from) {
              decorations.push(
                Decoration.inline(pending.from, pending.to, { class: "kc-comment--pending" })
              );
            }
            return DecorationSet.create(state.doc, decorations);
          },

          handleClick(view, pos) {
            if (!options.onAnchorClick) return false;
            const $pos = view.state.doc.resolve(pos);
            // marks() returns the marks of the character *before* pos, so a
            // click on a highlight's very first character would otherwise miss.
            const mark =
              $pos.marks().find((m) => m.type.name === markName) ??
              $pos.nodeAfter?.marks.find((m) => m.type.name === markName);
            const id = mark?.attrs.commentId as string | undefined;
            if (!id) return false;
            options.onAnchorClick(id);
            // Never return true: that would swallow the event and make it
            // impossible to select or edit text inside a highlight.
            return false;
          },
        },
      }),
    ];
  },
});
