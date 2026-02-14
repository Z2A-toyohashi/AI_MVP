-- AI共存空間 データベーススキーマ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);

-- 投稿テーブル
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  created_at BIGINT NOT NULL,
  thread_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'user',
  author_id TEXT NOT NULL REFERENCES users(id),
  media_url TEXT
);

-- ログテーブル
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

-- AI設定テーブル
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  system_prompt TEXT NOT NULL,
  check_interval INTEGER NOT NULL DEFAULT 30000,
  cooldown_min INTEGER NOT NULL DEFAULT 300000,
  cooldown_max INTEGER NOT NULL DEFAULT 900000,
  max_ai_density DECIMAL NOT NULL DEFAULT 0.2,
  delay_min INTEGER NOT NULL DEFAULT 5000,
  delay_max INTEGER NOT NULL DEFAULT 20000,
  prob_flow DECIMAL NOT NULL DEFAULT 0.0,
  prob_silence DECIMAL NOT NULL DEFAULT 0.35,
  prob_fragile DECIMAL NOT NULL DEFAULT 0.15,
  prob_solo DECIMAL NOT NULL DEFAULT 0.5,
  max_response_length INTEGER NOT NULL DEFAULT 10,
  gpt_temperature DECIMAL NOT NULL DEFAULT 1.0,
  gpt_presence_penalty DECIMAL NOT NULL DEFAULT 0.6,
  gpt_frequency_penalty DECIMAL NOT NULL DEFAULT 0.6,
  updated_at BIGINT NOT NULL
);

-- デフォルトのシステムプロンプトを挿入
INSERT INTO ai_settings (id, system_prompt, updated_at)
VALUES (
  'default',
  'あなたは匿名SNS「空間」の参加者です。他の参加者と同じように、自然な会話口調で投稿に反応してください。

ルール：
- 短く簡潔に（10文字以内が理想）
- 共感や相槌が中心
- 解決策を提示しない
- 主役にならない
- カジュアルな口調
- 絵文字は使わない

例：
「わかる」「それな」「そうなんだ」「へー」「なるほど」「そっか」',
  EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (id) DO NOTHING;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_thread_id ON posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_type ON posts(author_type);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON posts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON posts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON posts FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON ai_settings FOR SELECT USING (true);
CREATE POLICY "Enable update access for all users" ON ai_settings FOR UPDATE USING (true);
