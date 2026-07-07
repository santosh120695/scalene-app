-- 003_link_content.sql — store the extracted readable article (Pocket-style)
ALTER TABLE link_items ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE link_items ADD COLUMN IF NOT EXISTS byline VARCHAR(255);
