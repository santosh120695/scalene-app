import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  NotebookPen,
  Quote,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Command catalogue ───────────────────────────────────────────────
interface CommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

// Called when the "Image" command is picked. The host clears the slash range,
// then opens a file picker and uploads the chosen file (see RichTextEditor).
export type OnImage = (props: { editor: Editor; range: Range }) => void;

// Called when the "Sub-note" command is picked. The host clears the slash range
// and opens the picker, which either creates a child note or links an existing
// one (see NoteWithComments).
export type OnSubNote = (props: { editor: Editor; range: Range }) => void;

function buildCommands(onImage?: OnImage, onSubNote?: OnSubNote): CommandItem[] {
  return [
    ...BASE_COMMANDS,
    ...(onImage ? [imageCommand(onImage)] : []),
    ...(onSubNote ? [subNoteCommand(onSubNote)] : []),
  ];
}

function imageCommand(onImage: OnImage): CommandItem {
  return {
    title: "Image",
    description: "Upload an image",
    icon: ImageIcon,
    keywords: ["image", "picture", "photo", "img", "upload"],
    command: ({ editor, range }) => onImage({ editor, range }),
  };
}

function subNoteCommand(onSubNote: OnSubNote): CommandItem {
  return {
    title: "Sub-note",
    description: "Create a nested note, or link an existing one",
    icon: NotebookPen,
    keywords: ["sub", "subnote", "note", "link", "child", "nested", "page", "ref"],
    command: ({ editor, range }) => onSubNote({ editor, range }),
  };
}

const BASE_COMMANDS: CommandItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: Type,
    keywords: ["paragraph", "text", "body"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    keywords: ["h1", "title", "big"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    keywords: ["h2", "subtitle"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    keywords: ["h3"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    description: "An unordered list",
    icon: List,
    keywords: ["unordered", "ul", "bullet", "point"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "An ordered list",
    icon: ListOrdered,
    keywords: ["ordered", "ol", "number"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do List",
    description: "Checklist with checkboxes",
    icon: ListTodo,
    keywords: ["todo", "task", "checkbox", "checklist"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Capture a quotation",
    icon: Quote,
    keywords: ["blockquote", "citation"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    description: "Monospaced code",
    icon: Code2,
    keywords: ["code", "snippet", "pre"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "A horizontal rule",
    icon: Minus,
    keywords: ["hr", "horizontal", "rule", "separator", "line"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Table",
    description: "A 3×3 table",
    icon: Table2,
    keywords: ["table", "grid", "rows", "columns"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
];

function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return commands;
  return commands.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}

// ── The popup list (keyboard-navigable) ─────────────────────────────
interface ListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export interface SlashListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SlashCommandList = forwardRef<SlashListHandle, ListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => setSelected(0), [items]);

    // Keep the active row scrolled into view.
    useLayoutEffect(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        `[data-index="${selected}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selected]) command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="w-64 rounded-md border border-[var(--border)] bg-surface-primary p-2 text-[12px] text-ink-muted shadow-panel">
          No matching blocks
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="scroll-thin max-h-72 w-64 overflow-y-auto rounded-md border border-[var(--border)] bg-surface-primary p-1 shadow-panel"
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              data-index={index}
              onMouseEnter={() => setSelected(index)}
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors",
                index === selected ? "bg-surface-sunken" : "hover:bg-surface-sunken"
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-surface-primary text-ink-secondary">
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink-primary">
                  {item.title}
                </span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);
SlashCommandList.displayName = "SlashCommandList";

// ── The extension wiring Suggestion → the popup ─────────────────────
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      // Optional handler for the "Image" command; when absent the command is
      // hidden (e.g. the compact composer, which doesn't load this extension).
      onImage: undefined as OnImage | undefined,
      // Same pattern: hidden unless the host can service it. Only the full note
      // editor knows which note the sub-note would belong to.
      onSubNote: undefined as OnSubNote | undefined,
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: CommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const commands = buildCommands(this.options.onImage, this.options.onSubNote);
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterCommands(commands, query),
        render: () => {
          let component: ReactRenderer<SlashListHandle, ListProps>;
          let popup: Instance[];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                maxWidth: "none",
                animation: false,
                theme: "kc-slash",
              });
            },
            onUpdate: (props: any) => {
              component?.updateProps(props);
              if (!props.clientRect) return;
              popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
