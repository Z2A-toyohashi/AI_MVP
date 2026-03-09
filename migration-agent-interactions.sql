-- エージェント間交流カウント用カラムを追加
ALTER TABLE agents ADD COLUMN IF NOT EXISTS daily_interaction_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_interaction_reset_at BIGINT DEFAULT 0;
