// Templates offered when creating a new note (the board note editor). These are
// deliberately kept separate from the journal's DB-backed templates — a note is
// just an item whose `content` is Tiptap HTML, so a template here is only the
// initial HTML we scaffold into that new note. No backend seeding required.

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  // Initial Tiptap HTML the new note opens with. The first block is a heading so
  // the note's title (extracted from the first block on save) reads sensibly.
  content: string;
}

// The task-list markup mirrors exactly what Tiptap's TaskList/TaskItem parse and
// serialize (`<ul data-type="taskList">` / `<li data-type="taskItem"
// data-checked="false">`), so the editor rehydrates it as a real checklist and
// the backend can register each item as a todo on first save.
const TODO_ITEM =
  '<li data-type="taskItem" data-checked="false"><p data-placeholder="To-do item"></p></li>';

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "standard",
    name: "Standard",
    description: "A heading and a blank page to write on.",
    content:
      '<h1 data-placeholder="Untitled"></h1><p data-placeholder="Start writing…"></p>',
  },
  {
    id: "todos",
    name: "To-dos",
    description: "A heading and a checklist to tick off.",
    content: `<h1 data-placeholder="Untitled"></h1><ul data-type="taskList">${TODO_ITEM}${TODO_ITEM}${TODO_ITEM}</ul>`,
  },
];
