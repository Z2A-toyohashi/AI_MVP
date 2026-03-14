-- postsテーブルにスレッドタイトルを追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;

-- reply_countはビューで計算するのでカラム不要
-- titleインデックス
CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title) WHERE title IS NOT NULL;
