import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import * as itemsApi from "@/api/items";
import { boardKeys } from "@/hooks/useBoards";
import { todoKeys } from "@/hooks/useTodos";
import {
  groupThreads,
  useCommentsList,
  useCreateComment,
  useDeleteComment,
  useResolveComment,
} from "@/hooks/useComments";
import {
  RichTextEditor,
  type CommentsWiring,
  type NoteLinkWiring,
} from "@/components/editor/RichTextEditor";
import { commentPluginKey } from "@/components/editor/comment-mark";
import { UNTITLED_NOTE } from "@/components/editor/note-link";
import { CommentsDrawer, type PendingThread } from "@/components/detail/CommentsDrawer";
import { SubNoteDialog } from "@/components/detail/SubNoteDialog";
import { WordCount } from "@/components/detail/WordCount";
import type { PickedItem } from "@/components/detail/ItemTreePicker";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import type { NoteItem } from "@/types";

interface Props {
  note: NoteItem;
  boardId: string;
  commentsOpen: boolean;
  onCommentsOpenChange: (open: boolean) => void;
  onStatus: (status: string) => void;
}

/**
 * The note editor and its comments drawer, together, because they share the
 * save sequencing that keeps highlights and comment rows consistent.
 *
 * The invariant: a `<mark data-comment-id>` is never written into the note
 * until the comment row it points at exists on the server. While a comment is
 * being composed the highlight is only a ProseMirror *decoration*, so the note
 * stays undirtied and an ordinary blur-save cannot persist a stray highlight.
 */
export function NoteWithComments({
  note,
  boardId,
  commentsOpen,
  onCommentsOpenChange,
  onStatus,
}: Props) {
  const qc = useQueryClient();
  const [content, setContent] = useState(note.content ?? "");
  // Saves read the live HTML from here, never from the `content` closure: a
  // save fired immediately after applying a mark would otherwise persist the
  // pre-mark state, since React state has not re-rendered yet.
  const contentRef = useRef(content);
  const dirty = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);

  const [pending, setPending] = useState<PendingThread | null>(null);
  // Read inside save(), which is not re-created per render — keep it in a ref.
  const pendingRef = useRef(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [anchorOrder, setAnchorOrder] = useState<string[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [subNoteOpen, setSubNoteOpen] = useState(false);
  const [creatingSubNote, setCreatingSubNote] = useState(false);
  const navigate = useNavigate();

  const commentsQuery = useCommentsList(note.id);
  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
  const createComment = useCreateComment(note.id);
  const deleteComment = useDeleteComment(note.id);
  const resolveComment = useResolveComment(note.id);

  const threads = useMemo(
    () => groupThreads(comments, anchorOrder),
    [comments, anchorOrder]
  );

  useEffect(() => () => onStatus(""), [onStatus]);

  // ---- saving ----------------------------------------------------------------

  const save = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!dirty.current && !opts?.force) return;
      const html = editorRef.current?.getHTML() ?? contentRef.current;
      onStatus("Saving…");
      try {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const title = parsed.body.children[0]?.textContent?.trim() ?? "";
        const updated = (await itemsApi.updateNote(note.id, {
          title,
          content: html,
        })) as NoteItem;
        dirty.current = false;
        // The backend injects stable ids into new checklist items — pick up
        // that rewritten HTML. Skipped while a comment is being composed: the
        // re-parse would destroy the pending decoration mid-composition, and
        // this only ever needs to land by the following save.
        if (updated.content && updated.content !== html && !pendingRef.current) {
          contentRef.current = updated.content;
          setContent(updated.content);
        }
        onStatus("Saved");
        qc.invalidateQueries({ queryKey: ["item", note.id] });
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
        qc.invalidateQueries({ queryKey: todoKeys.list });
        // Renaming this note rewrites its label in every note that links to it
        // (see refreshLinksTo). An ancestor open in the other split pane is
        // showing the old label until its query refetches.
        for (const crumb of note.parentChain ?? []) {
          qc.invalidateQueries({ queryKey: ["item", crumb.id] });
        }
      } catch (e) {
        onStatus("");
        toast.error(errMessage(e, "Could not save note"));
        throw e;
      }
    },
    [boardId, note.id, note.parentChain, onStatus, qc]
  );

  // Adopt content that changed on the server while this editor sat idle — a
  // link label rewritten because the note it points at was renamed elsewhere.
  // Skipped whenever there are unsaved edits: a refetch must never clobber
  // what the user is in the middle of typing.
  useEffect(() => {
    const incoming = note.content ?? "";
    if (dirty.current || incoming === contentRef.current) return;
    contentRef.current = incoming;
    setContent(incoming);
  }, [note.content]);

  // ---- editor wiring ---------------------------------------------------------

  const openThread = useCallback(
    (anchorId: string) => {
      setActiveAnchorId(anchorId);
      onCommentsOpenChange(true);
    },
    [onCommentsOpenChange]
  );

  const commentsWiring: CommentsWiring = useMemo(
    () => ({
      onCreateAnchor: (quotedText) => {
        setPending({ quotedText });
        pendingRef.current = true;
        setActiveAnchorId(null);
        onCommentsOpenChange(true);
      },
      onAnchorClick: openThread,
      onAnchorsChange: setAnchorOrder,
    }),
    [onCommentsOpenChange, openThread]
  );

  // The ref is what the imperative handlers below read; the state is only so
  // the word counter can subscribe to the editor once it exists.
  const handleEditorReady = useCallback((next: Editor | null) => {
    editorRef.current = next;
    setEditor(next);
  }, []);

  const openSubNote = useCallback(
    (targetId: string) => {
      // Beside the parent rather than replacing it, so the note you're reading
      // stays on screen.
      navigate(`/b/${boardId}/item/${note.id}?split=${targetId}`);
    },
    [boardId, navigate, note.id],
  );

  const noteLinkWiring: NoteLinkWiring = useMemo(
    () => ({
      itemId: note.id,
      boardId,
      onRequestLink: () => setSubNoteOpen(true),
      onOpenLink: openSubNote,
    }),
    [boardId, note.id, openSubNote],
  );

  // Paint resolved highlights. Decoration-only, so toggling resolve never
  // rewrites the note HTML.
  useEffect(() => {
    const ids = comments.filter((c) => c.isThreadRoot && c.resolvedAt).map((c) => c.anchorId);
    editorRef.current?.commands.setResolvedComments(ids);
  }, [comments]);

  useEffect(() => {
    editorRef.current?.commands.setActiveComment(activeAnchorId);
  }, [activeAnchorId]);

  // ---- comment actions -------------------------------------------------------

  // The ordering that makes an orphan highlight impossible: create the row,
  // and only once it exists write the mark and force the note to save.
  async function submitPending(text: string) {
    const ed = editorRef.current;
    if (!ed) return;
    const anchorId = crypto.randomUUID();
    try {
      await createComment.mutateAsync({
        anchorId,
        content: text,
        quotedText: pending?.quotedText ?? "",
      });
    } catch (e) {
      // Nothing was written anywhere — the composer keeps its text and the
      // pending decoration stays, so this is fully retryable.
      toast.error(errMessage(e, "Could not add comment"));
      return;
    }

    // The pending range has been mapped through every edit made while the
    // composer was open, so it still covers the originally selected text.
    const range = commentPluginKey.getState(ed.state)?.pending;
    setPending(null);
    pendingRef.current = false;
    if (range && range.to > range.from) {
      ed.chain().setTextSelection(range).setComment(anchorId).clearPendingComment().run();
      dirty.current = true;
      // If this fails the row still exists and shows under "Detached" on
      // reload — visible and fixable, never a silent orphan highlight.
      await save({ force: true }).catch(() => {});
    } else {
      ed.commands.clearPendingComment();
    }
    setActiveAnchorId(anchorId);
  }

  function cancelPending() {
    // The entire cleanup: no mark to unset, no row to delete, nothing persisted.
    editorRef.current?.commands.clearPendingComment();
    setPending(null);
    pendingRef.current = false;
  }

  async function reply(anchorId: string, text: string) {
    try {
      await createComment.mutateAsync({ anchorId, content: text });
    } catch (e) {
      toast.error(errMessage(e, "Could not add reply"));
    }
  }

  async function remove(id: string) {
    try {
      const res = await deleteComment.mutateAsync(id);
      // Deleting a thread's first comment takes the whole thread, so the
      // highlight it anchored has to go too.
      if (res.threadDeleted) {
        const ed = editorRef.current;
        if (ed?.commands.unsetCommentById(res.anchorId)) {
          dirty.current = true;
          await save({ force: true }).catch(() => {});
        }
        if (activeAnchorId === res.anchorId) setActiveAnchorId(null);
      }
    } catch (e) {
      toast.error(errMessage(e, "Could not delete comment"));
    }
  }

  function resolve(rootId: string, resolved: boolean) {
    resolveComment.mutate(
      { id: rootId, resolved },
      { onError: (e) => toast.error(errMessage(e, "Could not update the thread")) }
    );
  }

  // Writes the chip and persists the note. Shared by both dialog paths — the
  // only difference is whether a note was created first.
  async function insertLink(targetId: string, label: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain().focus().insertNoteLink({ targetId, label }).run();
    dirty.current = true;
    await save({ force: true }).catch(() => {});
  }

  // Create the note FIRST, then write the chip. The reverse would leave a chip
  // pointing at nothing if the POST failed. The residual risk runs the other
  // way — a created note whose chip never persisted — and that one is
  // recoverable, because the note shows in the parent's sub-notes list below.
  async function createSubNote() {
    if (creatingSubNote) return;
    setCreatingSubNote(true);
    try {
      const created = await itemsApi.createNote({
        boardId,
        parentItemId: note.id,
        title: "",
        content: "",
      });
      setSubNoteOpen(false);
      await insertLink(created.id, UNTITLED_NOTE);
      qc.invalidateQueries({ queryKey: ["item", note.id] });
      openSubNote(created.id);
    } catch (e) {
      toast.error(errMessage(e, "Could not create the sub-note"));
    } finally {
      setCreatingSubNote(false);
    }
  }

  // Linking an existing note does NOT adopt it: it keeps its parent (or stays
  // top-level) and its place on its own board. Nothing is created, so a failure
  // here is fully retryable and can't orphan anything.
  async function linkExistingNote(targetId: string, meta?: PickedItem) {
    setSubNoteOpen(false);
    await insertLink(targetId, meta?.title || UNTITLED_NOTE);
  }

  function removeOrphanHighlight(anchorId: string) {
    const ed = editorRef.current;
    if (!ed?.commands.unsetCommentById(anchorId)) return;
    dirty.current = true;
    setActiveAnchorId(null);
    void save({ force: true }).catch(() => {});
  }

  // Clicking a thread scrolls the note to its highlight.
  function focusThread(anchorId: string) {
    setActiveAnchorId(anchorId);
    editorPaneRef.current
      ?.querySelector(`[data-comment-id="${CSS.escape(anchorId)}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // A highlight whose row is gone (deleted in another tab). Only trusted once
  // the query has actually succeeded — the cache is IndexedDB-persisted, so a
  // cold offline start can hand back an empty list.
  const orphanAnchorId =
    commentsQuery.isSuccess &&
    activeAnchorId &&
    !threads.some((t) => t.anchorId === activeAnchorId)
      ? activeAnchorId
      : null;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Positioning context for the word counter: it sits outside the scroll
          container so it stays pinned to the pane instead of scrolling away
          with the text. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={editorPaneRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div className="note-doc mx-auto w-full max-w-[1000px] px-1 py-8 sm:px-12">
            <RichTextEditor
              value={content}
              onChange={(html) => {
                contentRef.current = html;
                setContent(html);
                dirty.current = true;
                onStatus("");
              }}
              onBlur={() => void save()}
              onEditorReady={handleEditorReady}
              comments={commentsWiring}
              noteLinks={noteLinkWiring}
              placeholder="Type '/' for commands, or just start writing…"
              minHeight={600}
              className="bg-card"
              bare
            />
          </div>
        </div>
        {editor && <WordCount editor={editor} />}
      </div>

      <CommentsDrawer
        open={commentsOpen}
        threads={threads}
        activeAnchorId={activeAnchorId}
        pending={pending}
        showResolved={showResolved}
        busy={createComment.isPending || deleteComment.isPending}
        orphanAnchorId={orphanAnchorId}
        onClose={() => onCommentsOpenChange(false)}
        onToggleResolved={() => setShowResolved((v) => !v)}
        onFocusThread={focusThread}
        onSubmitPending={submitPending}
        onCancelPending={cancelPending}
        onReply={reply}
        onDelete={remove}
        onResolve={resolve}
        onRemoveOrphanHighlight={removeOrphanHighlight}
      />

      <SubNoteDialog
        open={subNoteOpen}
        onOpenChange={setSubNoteOpen}
        currentItemId={note.id}
        busy={creatingSubNote}
        onCreate={createSubNote}
        onPick={linkExistingNote}
      />
    </div>
  );
}
