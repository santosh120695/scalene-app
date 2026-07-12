-- 008_editor_images.sql — images embedded inline in TipTap note/sub-note content.
-- Unlike image_items (which are first-class canvas items), these are anonymous
-- blobs referenced by <img> tags in note HTML. Each row maps a stable UUID to a
-- storage key so the /editor/images/:id serve route can redirect to a freshly
-- presigned URL (embedded presigned URLs would otherwise expire).
CREATE TABLE IF NOT EXISTS editor_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  mime_type  VARCHAR(100),
  file_size  BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editor_images_user_id ON editor_images(user_id);
