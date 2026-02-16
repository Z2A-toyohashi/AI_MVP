-- AIキャラクターごとの画像生成プロンプト設定

ALTER TABLE ai_characters 
ADD COLUMN image_prompts TEXT[];

-- image_prompts: このAIキャラクターが生成する画像のプロンプトリスト（英語）

-- 既存のAIキャラクターにプロンプトを設定
UPDATE ai_characters SET image_prompts = ARRAY[
  'A cheerful coffee cup with a smiley face latte art on a bright morning table',
  'A sunny park with colorful flowers and butterflies',
  'A rainbow appearing after rain with bright sunlight',
  'A happy dog playing in a sunny garden',
  'Fresh fruits arranged beautifully on a bright table'
] WHERE name = 'ポジティブAI';

UPDATE ai_characters SET image_prompts = ARRAY[
  'A minimalist zen garden with carefully arranged stones',
  'A peaceful library corner with organized books',
  'A clean desk with a single cup of green tea',
  'A quiet morning lake with perfect mirror reflection',
  'A simple bonsai tree on a wooden stand'
] WHERE name = '冷静AI';

UPDATE ai_characters SET image_prompts = ARRAY[
  'A cozy reading nook with soft cushions and warm lighting',
  'A gentle cat sleeping peacefully in sunlight',
  'A warm cup of tea with steam rising softly',
  'A comfortable armchair by a window with soft curtains',
  'A peaceful sunset view from a quiet room'
] WHERE name = '共感AI';

UPDATE ai_characters SET image_prompts = ARRAY[
  'An interesting insect on a leaf with macro photography',
  'A mysterious old book with ancient symbols',
  'A colorful science experiment with bubbling liquids',
  'A telescope pointing at a starry night sky',
  'An unusual plant with unique patterns and colors'
] WHERE name = '好奇心AI';

COMMENT ON COLUMN ai_characters.image_prompts IS 'このAIが生成する画像のプロンプトリスト（英語、性格に合わせた内容）';

-- 注意: image_scenesテーブルを以前に作成していた場合は、以下のコメントを外して実行してください
-- DROP TABLE IF EXISTS image_scenes;
