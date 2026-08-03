import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NoteLinkNodeView } from "./NoteLinkNodeView";

export const NOTE_LINK_NAME = "noteLink";
export const UNTITLED_NOTE = "Untitled note";

export interface NoteLinkOptions {
  // Fired when a link chip is clicked. Ref-backed by the host: this is captured
  // once at editor-creation time, like CommentMarkOptions.onAnchorClick.
  onOpen: ((targetItemId: string) => void) | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteLink: {
      insertNoteLink: (attrs: { targetId: string; label?: string }) => ReturnType;
      removeNoteLinkById: (targetId: string) => ReturnType;
    };
  }
}

/** Every note id linked from this document, in document order. */
export function noteLinkIdsInDoc(editor: Editor): string[] {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== NOTE_LINK_NAME) return true;
    const id = node.attrs.targetId as string | null;
    if (id && !ids.includes(id)) ids.push(id);
    return true;
  });
  return ids;
}

/**
 * An inline reference to another note, rendered as a clickable chip.
 *
 * Serializes to `<span data-note-link-id="…">Label</span>` — deliberately NOT an
 * `<a>`: sanitizeHtml (lib/utils) installs a DOMPurify hook that stamps
 * target="_blank" onto every `<a href>`, so on a read-only surface like a board
 * grid card a link chip would open a new tab and full-reload the SPA. A custom
 * element is worse still — DOMPurify's html profile strips unknown tags and
 * keeps only their text, so it would look right in the editor and silently
 * degrade to bare text everywhere else. `data-*` on a standard tag survives,
 * which is how data-todo-id and data-comment-id already round-trip.
 *
 * The label lives in the node's text rather than a second attribute so there is
 * one source of truth, and so the backend heal (syncNoteLinks) only has to
 * rewrite the text. It is refreshed server-side on every save — a note's title
 * changes whenever its first block is edited, and chasing that from the client
 * would dirty the document and pile up undo steps.
 */
export const NoteLink = Node.create<NoteLinkOptions>({
  name: NOTE_LINK_NAME,
  group: "inline",
  inline: true,
  // The label is data, not editable content — the user renames the target note,
  // not the chip.
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { onOpen: null };
  },

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-note-link-id"),
        renderHTML: (attrs) =>
          attrs.targetId ? { "data-note-link-id": attrs.targetId } : {},
      },
      label: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).textContent?.trim() ?? "",
        // Rendered as the element's text by renderHTML below, not as an
        // attribute — emitting both would let the two drift apart.
        renderHTML: () => ({}),
      },
      // Stamped by the backend when the target no longer exists. Never written
      // by the client, so a stale offline document self-corrects on next save.
      missing: {
        default: false,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-note-link-missing") === "true",
        renderHTML: (attrs) =>
          attrs.missing ? { "data-note-link-missing": "true" } : {},
      },
    };
  },

  parseHTML() {
    // Attribute-gated so an ordinary pasted <span> is never adopted as a link.
    // The high priority beats TextStyle's bare `span` rule, which is registered
    // in every editor.
    return [{ tag: "span[data-note-link-id]", priority: 1000 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "kc-note-link" }),
      (node.attrs.label as string) || UNTITLED_NOTE,
    ];
  },

  addCommands() {
    return {
      insertNoteLink:
        ({ targetId, label }) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs: { targetId, label: label || UNTITLED_NOTE } },
            // Atoms need a text position after them or the caret has nowhere to
            // land when the link ends a block.
            { type: "text", text: " " },
          ]),

      // Used when a target is deleted and the chip must go. By then the
      // selection is elsewhere, so this scans rather than acting on it.
      removeNoteLinkById:
        (targetId) =>
        ({ tr, state, dispatch }) => {
          const positions: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.targetId === targetId) {
              positions.push(pos);
            }
            return true;
          });
          if (positions.length === 0) return false;
          if (dispatch) {
            // Back to front, so each deletion can't shift the positions still
            // to be removed.
            for (const pos of positions.reverse()) {
              tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + 1));
            }
          }
          return true;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkNodeView);
  },
});
