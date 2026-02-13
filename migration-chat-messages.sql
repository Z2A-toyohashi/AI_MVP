-- 1on1チャットメッセージテーブルを追加

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'ai'
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT, -- 'image' or 'voice'
  created_at BIGINT NOT NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Enable read access for all users" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON chat_messages FOR INSERT WITH CHECK (true);
