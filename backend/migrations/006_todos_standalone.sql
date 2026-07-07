-- 006_todos_standalone.sql — quick-added todos no longer require a backing
-- note/board; item_id and board_id are only set for todos synced from a
-- note's checklist content.

ALTER TABLE todos ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE todos ALTER COLUMN board_id DROP NOT NULL;
