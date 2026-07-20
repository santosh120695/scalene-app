-- Soft delete: rows are stamped with deleted_at instead of being removed, so
-- deleted data stays recoverable. Cascades are handled in application code
-- (DB ON DELETE CASCADE does not fire on UPDATE).
ALTER TABLE boards        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE canvas_items  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sub_notes     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE todos         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE journal_days  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_boards_deleted_at        ON boards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_canvas_items_deleted_at  ON canvas_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sub_notes_deleted_at     ON sub_notes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_todos_deleted_at         ON todos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_journal_days_deleted_at  ON journal_days(deleted_at);
CREATE INDEX IF NOT EXISTS idx_journal_items_deleted_at ON journal_items(deleted_at);

-- Only live day rows must be unique per (user, date) so a date can be
-- re-created after its day row was soft-deleted.
ALTER TABLE journal_days DROP CONSTRAINT IF EXISTS journal_days_user_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_days_user_date_live
  ON journal_days(user_id, date) WHERE deleted_at IS NULL;
