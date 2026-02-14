-- GPTパラメータを追加するマイグレーション

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS gpt_temperature DECIMAL NOT NULL DEFAULT 1.0;

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS gpt_presence_penalty DECIMAL NOT NULL DEFAULT 0.6;

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS gpt_frequency_penalty DECIMAL NOT NULL DEFAULT 0.6;
