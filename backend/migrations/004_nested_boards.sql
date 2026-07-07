-- 004_nested_boards.sql — self-referential parent for board nesting (adjacency list)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS parent_id UUID
  REFERENCES boards(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_boards_parent_id ON boards(parent_id);
