-- 013_sub_notes.sql — a note can be nested inside another note (adjacency list).
--
-- Mirrors boards.parent_id (004_nested_boards.sql). ON DELETE CASCADE is declared
-- for referential completeness only: every delete path in this app is a soft
-- delete (011_soft_delete.sql) and CASCADE never fires on UPDATE, so the subtree
-- is walked in application code — see descendantItemIDs in items.go.
--
-- There is no DB-level cycle guard and none is needed: parent_item_id is written
-- exactly once, at creation, pointing at a row that already exists, so a cycle
-- cannot form. MoveItem is the only other writer and it only ever CLEARS it.
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS parent_item_id UUID
  REFERENCES canvas_items(id) ON DELETE CASCADE;

-- "children of this note", plus the recursive subtree walks. Partial because
-- nearly every row is top-level (NULL).
CREATE INDEX IF NOT EXISTS idx_canvas_items_parent_item_id
  ON canvas_items(parent_item_id) WHERE parent_item_id IS NOT NULL;

-- The board grid's hot query, now that it filters to top-level items only.
CREATE INDEX IF NOT EXISTS idx_canvas_items_board_toplevel
  ON canvas_items(board_id, is_pinned, sort_order)
  WHERE parent_item_id IS NULL AND deleted_at IS NULL;
