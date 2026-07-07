import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect } from "react";
import { SlashCommand } from "./slash-command";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Code2,
  Table2,
  Columns,
  Rows,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary",
        active && "bg-brand-light text-brand",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, className }: { editor: Editor; className?: string }) {
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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItemWithId.configure({ nested: false }),
      // Tables and the "/" command palette are full-editor-only — the compact
      // sub-note composer is too small (minHeight 56) for either to make sense.
      ...(compact
        ? []
        : [
            SlashCommand,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
          ]),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
  });

  // Keep editor content in sync if the value prop changes externally.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
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
      {!compact && <Toolbar editor={editor} className="lg:hidden" />}
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
