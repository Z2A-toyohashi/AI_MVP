-- AI設定テーブルに新しいカラムを追加するマイグレーション

-- 既存のカラムがない場合のみ追加
ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS check_interval INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN IF NOT EXISTS cooldown_min INTEGER NOT NULL DEFAULT 300000,
ADD COLUMN IF NOT EXISTS cooldown_max INTEGER NOT NULL DEFAULT 900000,
ADD COLUMN IF NOT EXISTS max_ai_density DECIMAL NOT NULL DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS delay_min INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN IF NOT EXISTS delay_max INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN IF NOT EXISTS prob_flow DECIMAL NOT NULL DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS prob_silence DECIMAL NOT NULL DEFAULT 0.35,
ADD COLUMN IF NOT EXISTS prob_fragile DECIMAL NOT NULL DEFAULT 0.15,
ADD COLUMN IF NOT EXISTS prob_solo DECIMAL NOT NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS max_response_length INTEGER NOT NULL DEFAULT 10;

-- 既存のレコードがある場合はデフォルト値で更新（念のため）
UPDATE ai_settings 
SET 
  check_interval = COALESCE(check_interval, 30000),
  cooldown_min = COALESCE(cooldown_min, 300000),
  cooldown_max = COALESCE(cooldown_max, 900000),
  max_ai_density = COALESCE(max_ai_density, 0.2),
  delay_min = COALESCE(delay_min, 5000),
  delay_max = COALESCE(delay_max, 20000),
  prob_flow = COALESCE(prob_flow, 0.0),
  prob_silence = COALESCE(prob_silence, 0.35),
  prob_fragile = COALESCE(prob_fragile, 0.15),
  prob_solo = COALESCE(prob_solo, 0.5),
  max_response_length = COALESCE(max_response_length, 10)
WHERE id = 'default';
