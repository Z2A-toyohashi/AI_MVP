-- 公園の会話ログテーブル
CREATE TABLE IF NOT EXISTS park_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  group_id TEXT NOT NULL,  -- 同じ会話グループのターンをまとめるID
  topic TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_park_conversations_created_at ON park_conversations(created_at DESC);

-- 古いデータを自動削除（24時間以上前）
-- Supabaseのpg_cronで定期実行するか、APIで手動削除
