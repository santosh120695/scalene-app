-- 002_items.sql — canvas_items + per-type child tables + sub_notes

CREATE TABLE IF NOT EXISTS canvas_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  item_type   VARCHAR(50) NOT NULL,        -- 'pdf' | 'link' | 'note' | 'image'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  color_label VARCHAR(50),
  is_pinned   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canvas_items_board_id   ON canvas_items(board_id);
CREATE INDEX IF NOT EXISTS idx_canvas_items_user_id    ON canvas_items(user_id);
CREATE INDEX IF NOT EXISTS idx_canvas_items_type       ON canvas_items(item_type);
CREATE INDEX IF NOT EXISTS idx_canvas_items_sort_order ON canvas_items(board_id, sort_order);

CREATE TABLE IF NOT EXISTS pdf_items (
  id            UUID PRIMARY KEY REFERENCES canvas_items(id) ON DELETE CASCADE,
  title         VARCHAR(500),
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  page_count    INTEGER,
  thumbnail_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_pdf_items_fts ON pdf_items
  USING GIN(to_tsvector('english', COALESCE(title, '')));

CREATE TABLE IF NOT EXISTS link_items (
  id            UUID PRIMARY KEY REFERENCES canvas_items(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  title         VARCHAR(500),
  description   TEXT,
  thumbnail_url TEXT,
  domain        VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_link_items_fts ON link_items
  USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));

CREATE TABLE IF NOT EXISTS note_items (
  id      UUID PRIMARY KEY REFERENCES canvas_items(id) ON DELETE CASCADE,
  title   VARCHAR(500),
  content TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_items_fts ON note_items
  USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));

CREATE TABLE IF NOT EXISTS image_items (
  id            UUID PRIMARY KEY REFERENCES canvas_items(id) ON DELETE CASCADE,
  caption       VARCHAR(500),
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  mime_type     VARCHAR(100),
  width_px      INTEGER,
  height_px     INTEGER,
  thumbnail_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_image_items_fts ON image_items
  USING GIN(to_tsvector('english', COALESCE(caption, '')));

CREATE TABLE IF NOT EXISTS sub_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES canvas_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  highlight   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_notes_item_id ON sub_notes(item_id);
