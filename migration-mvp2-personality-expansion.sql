-- 性格パラメータの拡張とナレッジシステム

-- personalityをより詳細に（8次元）
-- 既存: positive, talkative, curious
-- 追加: creative, logical, emotional, adventurous, cautious

-- 会話の要約をナレッジとして保存
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  last_referenced_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id ON agent_knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_importance ON agent_knowledge(importance DESC);

-- Row Level Security
ALTER TABLE agent_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for agent_knowledge" ON agent_knowledge FOR ALL USING (true) WITH CHECK (true);
