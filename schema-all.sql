-- ============================================================
-- Symbio (AI Living Lab) — 統合スキーマ
-- Supabase SQL Editor でこのファイルを一度実行してください
-- ============================================================

-- ============================================================
-- 1. ベーステーブル
-- ============================================================

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  display_name TEXT,
  avatar_url TEXT
);

-- 投稿
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

-- リアクション
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

-- フィードバック
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- ログ
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

-- AI設定（旧システム互換）
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

INSERT INTO ai_settings (id, system_prompt, updated_at)
VALUES (
  'default',
  'あなたは匿名SNS「空間」の参加者です。他の参加者と同じように、自然な会話口調で投稿に反応してください。短く簡潔に（10文字以内が理想）。共感や相槌が中心。絵文字は使わない。',
  EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. エージェント（AIキャラクター）
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'AI',
  personality JSONB NOT NULL DEFAULT '{"positive": 0, "talkative": 0, "curious": 0}'::jsonb,
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  appearance_stage INTEGER NOT NULL DEFAULT 1,
  character_image_url TEXT,
  last_active_at BIGINT NOT NULL,
  is_outside BOOLEAN NOT NULL DEFAULT false,
  can_post_to_sns BOOLEAN NOT NULL DEFAULT false,
  last_post_at BIGINT DEFAULT 0,
  daily_interaction_count INTEGER DEFAULT 0,
  last_interaction_reset_at BIGINT DEFAULT 0,
  created_at BIGINT NOT NULL,
  UNIQUE(user_id)
);

-- 会話履歴
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- イベント（AIが外で経験したこと）
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('meet', 'talk', 'fight', 'explore', 'learn')),
  content TEXT NOT NULL,
  partner_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- 遭遇（AI同士の交流記録）
CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_a_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_b_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  CHECK (agent_a_id < agent_b_id)
);

-- ナレッジ（会話の要約）
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  last_referenced_at BIGINT NOT NULL
);

-- 進化の軌跡
CREATE TABLE IF NOT EXISTS agent_evolution_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  appearance_stage INTEGER NOT NULL,
  stage_label TEXT,
  evolved BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

-- グローバルシステムプロンプト設定
CREATE TABLE IF NOT EXISTS agent_system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  system_prompt TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT single_row CHECK (id = 'default')
);

INSERT INTO agent_system_settings (id, system_prompt, updated_at)
VALUES (
  'default',
  'あなたは主人（ユーザー）の相棒のような存在です。主人のことを一番理解していて、主人と同じような考え方をします。1〜2文で短く返答。カジュアルな口調。主人の第二の自分として、主人の考え方を理解し共感する。',
  EXTRACT(EPOCH FROM NOW()) * 1000
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. チャット・DM
-- ============================================================

-- 1on1チャットメッセージ
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at BIGINT NOT NULL
);

-- AIキャラ間・ユーザー↔キャラ DM
-- from_agent_id=NULL: ユーザー発信
-- to_agent_id=NULL: ユーザー宛（AIキャラ→ユーザー）
CREATE TABLE IF NOT EXISTS agent_dms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent_id TEXT,
  to_agent_id TEXT,
  from_agent_name TEXT NOT NULL,
  to_agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ============================================================
-- 4. 公園・交流
-- ============================================================

-- 公園の会話ログ（24時間で自動削除対象）
CREATE TABLE IF NOT EXISTS park_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  group_id TEXT NOT NULL,
  topic TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- ============================================================
-- 5. インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_thread_id ON posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_type ON posts(author_type);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_last_post ON agents(last_post_at);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_unread ON events(agent_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_encounters_agents ON encounters(agent_a_id, agent_b_id);
CREATE INDEX IF NOT EXISTS idx_encounters_created ON encounters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id ON agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_importance ON agent_knowledge(importance DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_history_agent_id ON agent_evolution_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_dms_created_at ON agent_dms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_dms_agents ON agent_dms(from_agent_id, to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_dms_is_read ON agent_dms(is_read);
CREATE INDEX IF NOT EXISTS idx_park_conversations_created_at ON park_conversations(created_at DESC);

-- ============================================================
-- 6. Row Level Security & ポリシー
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_evolution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_dms ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_reactions" ON reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_feedback" ON feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_logs" ON logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_read_ai_settings" ON ai_settings FOR SELECT USING (true);
CREATE POLICY "public_update_ai_settings" ON ai_settings FOR UPDATE USING (true);
CREATE POLICY "public_all_agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_encounters" ON encounters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_knowledge" ON agent_knowledge FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_evolution" ON agent_evolution_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_system_settings" ON agent_system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_agent_dms" ON agent_dms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_park_conversations" ON park_conversations FOR ALL USING (true) WITH CHECK (true);
