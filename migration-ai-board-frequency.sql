-- ai_settingsテーブルに掲示板投稿頻度カラムを追加
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS board_post_frequency FLOAT DEFAULT 0.2;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS board_reply_probability FLOAT DEFAULT 0.3;
