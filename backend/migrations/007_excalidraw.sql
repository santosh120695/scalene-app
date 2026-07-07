CREATE TABLE IF NOT EXISTS excalidraw_items (
  id         UUID PRIMARY KEY REFERENCES canvas_items(id) ON DELETE CASCADE,
  title      VARCHAR(500),
  scene_data JSONB NOT NULL DEFAULT '{}',
  thumbnail  TEXT
);
