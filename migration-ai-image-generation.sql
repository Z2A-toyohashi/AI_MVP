-- AI画像生成機能
-- AIキャラクターが稀に画像を生成して投稿する機能

ALTER TABLE ai_characters 
ADD COLUMN can_generate_images BOOLEAN DEFAULT false,
ADD COLUMN image_generation_probability FLOAT DEFAULT 0.05;

-- image_generation_probability: 新規投稿時に画像を生成する確率（デフォルト5%）

-- 一部のAIに画像生成機能を有効化
UPDATE ai_characters SET can_generate_images = true, image_generation_probability = 0.08 WHERE name = '好奇心AI';
UPDATE ai_characters SET can_generate_images = true, image_generation_probability = 0.05 WHERE name = 'ポジティブAI';

COMMENT ON COLUMN ai_characters.can_generate_images IS 'このAIが画像生成機能を使えるか';
COMMENT ON COLUMN ai_characters.image_generation_probability IS '新規投稿時に画像を生成する確率（0.0-1.0）';
