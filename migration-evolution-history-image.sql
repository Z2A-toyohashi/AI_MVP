-- 進化の軌跡テーブルにキャラクター画像URLカラムを追加
ALTER TABLE agent_evolution_history
  ADD COLUMN IF NOT EXISTS character_image_url TEXT;
