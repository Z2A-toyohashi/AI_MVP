-- AIキャラ同士のDMテーブル
CREATE TABLE IF NOT EXISTS agent_dms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  from_agent_name TEXT NOT NULL,
  to_agent_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,  -- 返信メッセージ
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_agent_dms_created_at ON agent_dms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_dms_agents ON agent_dms(from_agent_id, to_agent_id);
