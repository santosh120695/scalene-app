-- 010_journal_item_tags.sql — free-form tags on journal items, mirroring the
-- boards.tags text[] + GIN pattern. Used to list all items sharing a tag.

ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_journal_items_tags ON journal_items USING GIN(tags);
