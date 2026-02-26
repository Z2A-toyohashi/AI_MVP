-- エージェントの最終投稿時刻を記録
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_post_at BIGINT DEFAULT 0;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_agents_last_post ON agents(last_post_at);
