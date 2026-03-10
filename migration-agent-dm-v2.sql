-- agent_dmsテーブルをユーザーDM対応に修正
-- from_agent_id / to_agent_id を nullable に変更（ユーザー発信・ユーザー宛に対応）
ALTER TABLE agent_dms ALTER COLUMN from_agent_id DROP NOT NULL;
ALTER TABLE agent_dms ALTER COLUMN to_agent_id DROP NOT NULL;

-- is_read カラムを追加（未読管理）
ALTER TABLE agent_dms ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_agent_dms_is_read ON agent_dms(is_read);
CREATE INDEX IF NOT EXISTS idx_agent_dms_from_null ON agent_dms(to_agent_id) WHERE from_agent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_dms_to_null ON agent_dms(from_agent_id) WHERE to_agent_id IS NULL;
