-- 012_comments.sql — highlight-anchored comments; replaces sub_notes.
--
-- A sub-note floated on an item with no position in the text. A comment is
-- anchored: the editor mints an anchor_id, writes it into the note HTML as
-- <mark data-comment-id="…">, and every comment sharing that anchor forms one
-- flat thread. The thread's first row (is_thread_root) owns the quoted text and
-- the resolve state for the whole thread.

CREATE TABLE IF NOT EXISTS comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID    NOT NULL REFERENCES canvas_items(id) ON DELETE CASCADE,

  -- Client-minted, mirrored into the note HTML. One thread per anchor.
  anchor_id      UUID    NOT NULL,
  is_thread_root BOOLEAN NOT NULL DEFAULT FALSE,
  -- Snapshot of the highlighted text, so a thread whose highlight was later
  -- deleted can still show what it was about.
  quoted_text    TEXT    NOT NULL DEFAULT '',

  user_id        UUID    NOT NULL REFERENCES users(id),
  content        TEXT    NOT NULL,

  -- Thread-level state; only ever set on the is_thread_root row.
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID    REFERENCES users(id) ON DELETE SET NULL,

  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,

  CONSTRAINT comments_resolved_root_chk CHECK (resolved_at IS NULL OR is_thread_root),
  CONSTRAINT comments_resolved_by_chk   CHECK (resolved_by IS NULL OR resolved_at IS NOT NULL)
);

-- The one hot query: every live comment on one item, in thread + time order.
CREATE INDEX IF NOT EXISTS idx_comments_item_live
  ON comments (item_id, anchor_id, created_at) WHERE deleted_at IS NULL;

-- Exactly one live root per anchor. Without this, a double-click on "Comment"
-- (or two tabs) forks a single highlight into two competing threads.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comments_thread_root_live
  ON comments (item_id, anchor_id) WHERE deleted_at IS NULL AND is_thread_root;

CREATE INDEX IF NOT EXISTS idx_comments_user_id    ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments(deleted_at);

-- Dropped clean, no backfill: sub-notes have no anchor in the text, so there is
-- nothing to migrate them onto. Nothing references sub_notes, so no CASCADE.
DROP TABLE IF EXISTS sub_notes;
