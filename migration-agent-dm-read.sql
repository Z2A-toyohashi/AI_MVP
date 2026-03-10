-- agent_dmsにis_readカラムを追加
ALTER TABLE agent_dms ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_dms_is_read ON agent_dms(is_read, to_agent_id);
