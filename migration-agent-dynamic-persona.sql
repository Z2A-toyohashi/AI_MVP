-- エージェントに動的ペルソナカラムを追加
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS dynamic_persona TEXT,
  ADD COLUMN IF NOT EXISTS persona_updated_at BIGINT;
