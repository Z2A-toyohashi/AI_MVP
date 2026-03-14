-- 掲示板機能拡張マイグレーション
-- 1. postsテーブルにtitleカラムが未追加の場合は追加（既存のmigration-board-threads.sqlと重複しないよう）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. ニューススレッド用のソースタグカラム
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_tag TEXT; -- 'news', 'agent', 'user' など

-- インデックス
CREATE INDEX IF NOT EXISTS idx_posts_source_tag ON posts(source_tag) WHERE source_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
