-- MVP Part 2: AIキャラクター共存プロダクト
-- 「自分のAIが、勝手に外で何かして帰ってくる」

-- エージェント（各ユーザーのAIキャラクター）
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
  created_at BIGINT NOT NULL,
  UNIQUE(user_id)
);

-- 会話（ユーザーとAIの1対1会話）
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

-- インデックス
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_unread ON events(agent_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_encounters_agents ON encounters(agent_a_id, agent_b_id);
CREATE INDEX IF NOT EXISTS idx_encounters_created ON encounters(created_at DESC);

-- Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

-- ポリシー（全ユーザーが読み書き可能 - MVP用）
CREATE POLICY "Enable all access for agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for encounters" ON encounters FOR ALL USING (true) WITH CHECK (true);
