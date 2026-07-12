-- 009_journal.sql — daily journal: each day is a container holding one or more
-- journal items. Templates seed item content and drive the picker preview.
-- Per-user preferences snapshot the default look into each new item.

CREATE TABLE IF NOT EXISTS journal_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,                         -- the user's local calendar day
  item_count  INTEGER NOT NULL DEFAULT 0,            -- server-maintained aggregate
  total_words INTEGER NOT NULL DEFAULT 0,            -- server-maintained aggregate
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)                             -- idempotent day creation at rollover
);
CREATE INDEX IF NOT EXISTS idx_journal_days_user_date ON journal_days(user_id, date DESC);

CREATE TABLE IF NOT EXISTS journal_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_day_id UUID NOT NULL REFERENCES journal_days(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(500) NOT NULL DEFAULT '',
  content        TEXT NOT NULL DEFAULT '',           -- Tiptap HTML
  style_config   JSONB NOT NULL DEFAULT '{}',        -- { backdrop:{type,value}, fontKey } snapshot
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_items_day ON journal_items(journal_day_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_user ON journal_items(user_id);

CREATE TABLE IF NOT EXISTS journal_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  template   JSONB NOT NULL DEFAULT '{}',            -- ordered sections drive scaffold + mini preview
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,         -- seeded templates shared by all users
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_config JSONB NOT NULL DEFAULT '{}',     -- { defaultTemplateId, backdrop:{type,value}, fontKey }
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)                                   -- one prefs row per user (upsert)
);

-- ---- Seed the 3 system templates ----
INSERT INTO journal_templates (name, template, is_system, sort_order) VALUES
  ('Todays log', '{"sections":[
      {"heading":"Topics covered","placeholder":"What did you study today?"},
      {"heading":"Doubts","placeholder":"What tripped you up?"},
      {"heading":"Tomorrow''s plan","placeholder":"Next steps"}]}', TRUE, 0),
  ('Mock test review', '{"sections":[
      {"heading":"Score","placeholder":"e.g. 142/200"},
      {"heading":"Mistakes","placeholder":"What went wrong?"},
      {"heading":"Weak areas","placeholder":"Topics to revisit"}]}', TRUE, 1),
  ('Free write', '{"sections":[
      {"heading":"","placeholder":"Start writing…"}]}', TRUE, 2)
ON CONFLICT DO NOTHING;
