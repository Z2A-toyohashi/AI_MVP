-- スレッドに有効期限と議事録カラムを追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS heat_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_is_archived ON posts(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_posts_heat_score ON posts(heat_score DESC) WHERE heat_score > 0;

-- 既存スレッド（thread_id IS NULL）にexpires_atをバックフィル（created_at + 3時間）
UPDATE posts
SET
  expires_at = created_at + (3 * 60 * 60 * 1000),
  is_archived = false,
  heat_score = COALESCE(heat_score, 0)
WHERE thread_id IS NULL
  AND expires_at IS NULL;
