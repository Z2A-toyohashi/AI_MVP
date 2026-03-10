-- agent_dmsテーブルにuser_idカラムを追加（ユーザーごとのDM分離）
ALTER TABLE agent_dms ADD COLUMN IF NOT EXISTS user_id TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_agent_dms_user_id ON agent_dms(user_id);
