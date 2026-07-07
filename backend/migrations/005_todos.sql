-- 005_todos.sql — checklist items extracted from note content, synced on save

CREATE TABLE IF NOT EXISTS todos (
  id           UUID PRIMARY KEY, -- matches the data-todo-id embedded in note HTML
  item_id      UUID NOT NULL REFERENCES canvas_items(id) ON DELETE CASCADE,
  board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id),
  text         TEXT NOT NULL DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON todos(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_todos_item_id ON todos(item_id);
