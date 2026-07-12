import {
  useEditor,
  useEditorState,
  EditorContent,
  type Editor,
} from "@tiptap/react";
// v3 moved the menu components out of the main entry and onto Floating UI.
import { BubbleMenu } from "@tiptap/react/menus";
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
import { SlashCommand, type OnImage } from "./slash-command";
import { ResizableImage } from "./resizable-image";
import { TrailingNode } from "./trailing-node";
import { BlockDragHandle } from "./BlockDragHandle";
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
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Handlers below are wired into the editor at creation time, before `editor`
  // exists — they reach the live instance through this ref instead.
  const editorRef = useRef<Editor | null>(null);

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
      Placeholder.configure({ placeholder }),
      // Registered everywhere so per-line color/font content renders in every
      // editor (including the read-only-ish sub-note composer); the controls to
      // set them live in the full editor's drag-handle menu.
      TextStyle,
      Color,
      FontFamily,
      TaskList,
      TaskItemWithId.configure({ nested: false }),
      // Loaded everywhere so embedded <img>s always render; the "add image"
      // affordances (toolbar, slash command, paste/drop) are gated to the full
      // editor below — the compact sub-note composer is too small for them.
      ResizableImage.configure({ inline: false, allowBase64: false }),
      // Tables and the "/" command palette are full-editor-only — the compact
      // sub-note composer is too small (minHeight 56) for either to make sense.
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
  });
  editorRef.current = editor;

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
