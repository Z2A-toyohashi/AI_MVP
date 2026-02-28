-- 進化の軌跡テーブル
CREATE TABLE IF NOT EXISTS agent_evolution_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  appearance_stage INTEGER NOT NULL,
  stage_label TEXT,
  evolved BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evolution_history_agent_id ON agent_evolution_history(agent_id);
