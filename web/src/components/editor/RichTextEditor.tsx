import {
  useEditor,
  useEditorState,
  EditorContent,
  type Editor,
} from "@tiptap/react";
// v3 moved the menu components out of the main entry and onto Floating UI.
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
// TextStyle is the base <span style> mark; Color and FontFamily hang their
// attributes off it. Used by the block drag-handle menu to recolor / re-font a
// single line, and to render that styling everywhere content is shown.
import { TextStyle, Color, FontFamily } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useCallback, useEffect, useRef } from "react";
import { SlashCommand, type OnImage, type OnSubNote } from "./slash-command";
import { ResizableImage } from "./resizable-image";
import { TrailingNode } from "./trailing-node";
import { BlockDragHandle } from "./BlockDragHandle";
import {
  CommentMark,
  COMMENT_MARK_NAME,
  anchorIdsInDoc,
  rangeHasComment,
} from "./comment-mark";
import { NoteLink } from "./note-link";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Code2,
  ImagePlus,
  Table2,
  Columns,
  Rows,
  Columns2,
  Rows2,
  BetweenVerticalStart,
  BetweenVerticalEnd,
  BetweenHorizontalStart,
  BetweenHorizontalEnd,
  Trash2,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadEditorImage } from "@/api/items";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";

// TipTap's TaskItem only tracks `checked` by default — it silently drops any
// other attribute on every parse/serialize round trip. The backend assigns a
// stable data-todo-id to each checklist item so it can be toggled/deleted from
// the central Todos view; without this extension that id would be wiped out
// (and a new one minted server-side) on the very next save.
const TaskItemWithId = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      todoId: {
        default: null,
        // Without this, pressing Enter to add a new checklist item copies
        // the PREVIOUS item's id onto the new one (TipTap's splitListItem
        // keeps attributes across a split unless told not to) — both then
        // sync to the same backend row and one silently overwrites the other.
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-todo-id"),
        renderHTML: (attributes) =>
          attributes.todoId ? { "data-todo-id": attributes.todoId } : {},
      },
    };
  },
});

// Lets a block carry its own placeholder hint via `data-placeholder`, which the
// Placeholder extension below surfaces while the block is empty. Note templates
// (see lib/noteTemplates) scaffold this attribute onto their heading/body/todo
// blocks so a fresh templated note shows per-section ghost text. keepOnSplit is
// off so pressing Enter starts a clean block instead of copying the hint down.
const PlaceholderAttr = Extension.create({
  name: "placeholderAttr",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          placeholder: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute("data-placeholder"),
            renderHTML: (attrs) =>
              attrs.placeholder
                ? { "data-placeholder": attrs.placeholder }
                : {},
          },
        },
      },
    ];
  },
});

// Wiring for note-to-note links. Ids are passed explicitly rather than read from
// the route: useParams() returns the LEFT split pane's item, so a chip in the
// right pane would act on the wrong note.
export interface NoteLinkWiring {
  itemId: string;
  boardId: string;
  // The "/" command was picked and its trigger text already deleted; the host
  // owns the picker dialog and the create/link sequencing from here.
  onRequestLink: () => void;
  onOpenLink: (targetItemId: string) => void;
}

// Wiring for highlight-anchored comments. Pass a memoized object — it is read
// through a ref internally, but a new identity on every render would still
// churn the effect that keeps that ref current.
export interface CommentsWiring {
  // The user selected text and pressed Comment. No anchor id yet and no mark
  // applied: the parent owns that sequencing (create the row first, only then
  // write the mark), so a cancelled composer can never leave a stray highlight.
  onCreateAnchor: (quotedText: string) => void;
  // The reader clicked an existing highlight.
  onAnchorClick: (anchorId: string) => void;
  // Anchor ids in document order, pushed up whenever the set changes. The
  // drawer orders threads by this — the server cannot know document order.
  onAnchorsChange: (anchorIds: string[]) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
  className?: string;
  // Render without the bordered box / focus ring (seamless writing surface).
  bare?: boolean;
  // Enables the comment affordances (selection menu + click-to-open). The mark
  // itself is always registered — see the extension list.
  comments?: CommentsWiring;
  // Enables the "/" sub-note command. The node itself is always registered.
  noteLinks?: NoteLinkWiring;
  // Hands the live editor to the parent so it can run comment commands.
  onEditorReady?: (editor: Editor | null) => void;
}

function ToolbarButton({
  active,
  onClick,
  label,
  danger,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  // Destructive action — turns red on hover (delete row/column/table).
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors",
        danger
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-surface-sunken hover:text-ink-primary",
        active && "bg-brand-light text-brand",
      )}
    >
      {children}
    </button>
  );
}

// Floating toolbar shown whenever the cursor is inside a table, on every screen
// size. Provides the full set of row/column insert + delete controls (the
// StarterKit table extension exposes the commands; there was previously no UI
// for delete-row/-column or insert-before).
function TableMenu({ editor }: { editor: Editor }) {
  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    fn(editor.chain().focus()).run();
  const divider = <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor }) => editor.isActive("table")}
      // v3 positions the menu with Floating UI; styling is handled by the child.
      options={{ placement: "top" }}
    >
      <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-surface-primary p-1 shadow-panel">
        <ToolbarButton
          label="Insert column left"
          onClick={() => run((c) => c.addColumnBefore())}
        >
          <BetweenVerticalStart size={15} strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Insert column right"
          onClick={() => run((c) => c.addColumnAfter())}
        >
          <BetweenVerticalEnd size={15} strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Delete column"
          danger
          onClick={() => run((c) => c.deleteColumn())}
        >
          <Columns2 size={15} strokeWidth={1.5} />
        </ToolbarButton>
        {divider}
        <ToolbarButton
          label="Insert row above"
          onClick={() => run((c) => c.addRowBefore())}
        >
          <BetweenHorizontalStart size={15} strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Insert row below"
          onClick={() => run((c) => c.addRowAfter())}
        >
          <BetweenHorizontalEnd size={15} strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Delete row"
          danger
          onClick={() => run((c) => c.deleteRow())}
        >
          <Rows2 size={15} strokeWidth={1.5} />
        </ToolbarButton>
        {divider}
        <ToolbarButton
          label="Delete table"
          danger
          onClick={() => run((c) => c.deleteTable())}
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </ToolbarButton>
      </div>
    </BubbleMenu>
  );
}

// Floating "Comment" button shown over a non-empty text selection. Separate
// from TableMenu (which owns the same placement inside tables) and gated off
// already-commented text, since overlapping highlights are refused.
function SelectionMenu({ editor, onComment }: { editor: Editor; onComment: () => void }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="commentMenu"
      shouldShow={({ editor, state, from, to }) =>
        from !== to &&
        state.doc.textBetween(from, to, " ").trim().length > 0 &&
        !editor.isActive("table") &&
        !editor.isActive("codeBlock") &&
        !editor.isActive(COMMENT_MARK_NAME)
      }
      options={{ placement: "top" }}
    >
      <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-surface-primary p-1 shadow-panel">
        <ToolbarButton label="Comment" onClick={onComment}>
          <MessageSquarePlus size={15} strokeWidth={1.5} />
        </ToolbarButton>
      </div>
    </BubbleMenu>
  );
}

function Toolbar({
  editor,
  className,
  onAddImage,
}: {
  editor: Editor;
  className?: string;
  onAddImage?: () => void;
}) {
  // Re-derive active-mark state on every selection/transaction, not just on
  // content changes — otherwise moving the cursor into a table wouldn't
  // reveal the table-editing buttons until the next keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      heading2: editor.isActive("heading", { level: 2 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      taskList: editor.isActive("taskList"),
      codeBlock: editor.isActive("codeBlock"),
      table: editor.isActive("table"),
    }),
  });

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 border-b border-[var(--border)] px-1 py-1",
        className,
      )}
    >
      <ToolbarButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Heading"
        active={state.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="To-do list"
        active={state.taskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo size={15} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={15} strokeWidth={1.5} />
      </ToolbarButton>
      {onAddImage && (
        <ToolbarButton label="Insert image" onClick={onAddImage}>
          <ImagePlus size={15} strokeWidth={1.5} />
        </ToolbarButton>
      )}
      <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
      <ToolbarButton
        label="Insert table"
        active={state.table}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <Table2 size={15} strokeWidth={1.5} />
      </ToolbarButton>
      {state.table && (
        <>
          <ToolbarButton
            label="Add column"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns size={15} strokeWidth={1.5} />
          </ToolbarButton>
          <ToolbarButton
            label="Add row"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows size={15} strokeWidth={1.5} />
          </ToolbarButton>
          <ToolbarButton
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 size={15} strokeWidth={1.5} />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Write something…",
  minHeight = 120,
  compact = false,
  className,
  bare = false,
  comments,
  noteLinks,
  onEditorReady,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Handlers below are wired into the editor at creation time, before `editor`
  // exists — they reach the live instance through this ref instead.
  const editorRef = useRef<Editor | null>(null);
  // Same trick for the comment callbacks: the extension captures its options
  // once, but the drawer's setters are recreated on every parent render.
  const commentsRef = useRef<CommentsWiring | undefined>(comments);
  commentsRef.current = comments;
  const noteLinksRef = useRef<NoteLinkWiring | undefined>(noteLinks);
  noteLinksRef.current = noteLinks;
  const lastAnchorsRef = useRef<string>("");

  // Upload one image file and insert it at the current selection.
  const uploadAndInsert = useCallback(async (file: File) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be added");
      return;
    }
    try {
      const { url } = await uploadEditorImage(file);
      ed.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(errMessage(err, "Could not upload image"));
    }
  }, []);

  // Pull any image files out of a paste/drop and upload them; returns true when
  // at least one was handled so ProseMirror skips its default text handling.
  const handleImageFiles = useCallback(
    (files: FileList | null | undefined): boolean => {
      const images = Array.from(files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (images.length === 0) return false;
      images.forEach((f) => void uploadAndInsert(f));
      return true;
    },
    [uploadAndInsert],
  );

  const editor = useEditor({
    // Client-only SPA (no SSR) — render immediately to avoid a first-paint flash.
    immediatelyRender: true,
    extensions: [
      // v3's StarterKit bundles TrailingNode (we register our own below) plus
      // Link/Underline, which the editor didn't have before — disable all three
      // to keep behavior identical to the v2 setup.
      StarterKit.configure({
        trailingNode: false,
        link: false,
        underline: false,
      }),
      PlaceholderAttr,
      Placeholder.configure({
        // Decorate every empty block (including nested todo paragraphs), not
        // just the focused one, so a templated note shows all its hints at once.
        includeChildren: true,
        showOnlyCurrent: false,
        // A block's own hint wins; otherwise only the whole-editor-empty prompt
        // shows (returning "" leaves ordinary empty lines hint-free as before).
        placeholder: ({ editor, node }) =>
          (node.attrs.placeholder as string | null) ||
          (editor.isEmpty ? placeholder : ""),
      }),
      // Registered everywhere so per-line color/font content renders in every
      // editor (including compact ones); the controls to set them live in the
      // full editor's drag-handle menu.
      TextStyle,
      Color,
      FontFamily,
      TaskList,
      TaskItemWithId.configure({ nested: false }),
      // Registered in EVERY editor, compact ones included: an editor without
      // this extension parses <mark data-comment-id> as unknown and silently
      // drops the attribute on the next getHTML() — the same trap the
      // TaskItemWithId comment above describes. Only the UI is gated below.
      CommentMark.configure({
        onAnchorClick: (id) => commentsRef.current?.onAnchorClick(id),
      }),
      // Registered everywhere for the same reason as CommentMark above: an
      // editor without this node parses <span data-note-link-id> as an unknown
      // element and drops it on the next getHTML(). Only the "/" command that
      // creates one is gated to the full editor.
      NoteLink.configure({
        onOpen: (targetId) => noteLinksRef.current?.onOpenLink(targetId),
      }),
      // Loaded everywhere so embedded <img>s always render; the "add image"
      // affordances (toolbar, slash command, paste/drop) are gated to the full
      // editor below — a compact composer is too small for them.
      ResizableImage.configure({ inline: false, allowBase64: false }),
      // Tables and the "/" command palette are full-editor-only — a compact
      // composer is too small (minHeight 56) for either to make sense.
      ...(compact
        ? []
        : [
            // Guarantees a paragraph after a trailing image/table so the user
            // can always click below it and keep writing.
            TrailingNode,
            SlashCommand.configure({
              onImage: (({ editor, range }) => {
                // Drop the "/…" trigger text, then open the file picker.
                editor.chain().focus().deleteRange(range).run();
                fileInputRef.current?.click();
              }) as OnImage,
              // Only offered when the host can say which note this belongs to.
              // Options are snapshotted at editor creation, so this reads the
              // ref rather than closing over the current render's props.
              onSubNote: (noteLinks
                ? ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).run();
                    noteLinksRef.current?.onRequestLink();
                  }
                : undefined) as OnSubNote | undefined,
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
          ]),
    ],
    content: value,
    editorProps: compact
      ? undefined
      : {
          handlePaste: (_view, event) => {
            if (handleImageFiles(event.clipboardData?.files)) {
              event.preventDefault();
              return true;
            }
            return false;
          },
          handleDrop: (_view, event) => {
            if (handleImageFiles((event as DragEvent).dataTransfer?.files)) {
              event.preventDefault();
              return true;
            }
            return false;
          },
        },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    // Selection-only transactions change which anchors exist too (undo/redo,
    // paste), so watch every transaction — but only push up when the set
    // actually changed, or the drawer would re-render on every keystroke.
    onTransaction: ({ editor }) => {
      if (!commentsRef.current) return;
      const ids = anchorIdsInDoc(editor);
      const joined = ids.join("|");
      if (joined === lastAnchorsRef.current) return;
      lastAnchorsRef.current = joined;
      commentsRef.current.onAnchorsChange(ids);
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  // Mark the selection as pending (a decoration only — the document is left
  // untouched, so this cannot dirty the note) and hand the quoted text up. The
  // real mark is applied by the parent once the comment row exists.
  const startComment = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    if (rangeHasComment(ed, from, to)) {
      toast.error("This text already has a comment");
      return;
    }
    const quoted = ed.state.doc.textBetween(from, to, " ").trim();
    if (!quoted) return;
    ed.commands.setPendingComment(from, to);
    commentsRef.current?.onCreateAnchor(quoted);
  }, []);

  // Insert the file chosen via the hidden picker, then reset so the same file
  // can be selected again next time.
  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadAndInsert(file);
  };

  // Keep editor content in sync if the value prop changes externally.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md bg-surface-primary",
        !bare &&
          "border border-[var(--border-default)] focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-light",
        className,
      )}
    >
      {!compact && (
        <>
          <Toolbar
            editor={editor}
            className="lg:hidden"
            onAddImage={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
          <TableMenu editor={editor} />
          {comments && <SelectionMenu editor={editor} onComment={startComment} />}
          <BlockDragHandle editor={editor} />
        </>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "tiptap px-6 py-2 text-[12px] text-ink-primary",
          !compact && "mt-2"
        )}
        style={{ minHeight }}
      />
    </div>
  );
}
