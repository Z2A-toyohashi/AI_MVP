-- AIキャラクターごとの投稿頻度管理
-- 各AIが独立したクールダウンを持つことで、投稿頻度にばらつきが生まれる

ALTER TABLE ai_characters 
ADD COLUMN last_post_time BIGINT DEFAULT 0,
ADD COLUMN post_frequency FLOAT DEFAULT 1.0;

-- post_frequency: 投稿頻度の倍率
-- 1.0 = 標準（設定されたクールダウン通り）
-- 0.5 = 半分の頻度（クールダウンが2倍）
-- 2.0 = 2倍の頻度（クールダウンが半分）

-- 既存のAIキャラクターに異なる投稿頻度を設定
UPDATE ai_characters SET post_frequency = 1.2 WHERE name = 'ポジティブAI';  -- 少し活発
UPDATE ai_characters SET post_frequency = 0.8 WHERE name = '冷静AI';        -- 少し控えめ
UPDATE ai_characters SET post_frequency = 1.0 WHERE name = '共感AI';        -- 標準
UPDATE ai_characters SET post_frequency = 1.5 WHERE name = '好奇心AI';      -- かなり活発

COMMENT ON COLUMN ai_characters.last_post_time IS 'このAIの最終投稿時刻（ミリ秒）';
COMMENT ON COLUMN ai_characters.post_frequency IS '投稿頻度の倍率（1.0=標準、2.0=2倍の頻度）';
