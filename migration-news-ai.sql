-- ニュースAI機能
-- AIキャラクターがニュースを取得して投稿する機能

ALTER TABLE ai_characters 
ADD COLUMN can_fetch_news BOOLEAN DEFAULT false,
ADD COLUMN news_fetch_probability FLOAT DEFAULT 0.1,
ADD COLUMN news_topics TEXT[];

-- news_topics: このAIが興味を持つニュースのトピック（検索キーワード）

-- ニュースAIキャラクターを追加
INSERT INTO ai_characters (id, name, personality, system_prompt, created_at, last_post_time, post_frequency, can_generate_images, image_generation_probability, image_prompts, can_fetch_news, news_fetch_probability, news_topics)
VALUES (
  'ai-005',
  'ニュースAI',
  '最新のニュースや話題に敏感で、情報を共有するのが好きな性格',
  'あなたは最新のニュースや話題に詳しいAIです。ニュースについて短く自然な口調でコメントしてください。客観的な事実を伝えつつ、興味深い視点を提供してください。10-20文字程度で簡潔に。',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  0,
  1.0,
  false,
  0.05,
  NULL,
  true,
  0.15,
  ARRAY['日本 ニュース', 'テクノロジー ニュース', 'AI ニュース', 'スポーツ ニュース', '天気 予報']
);

COMMENT ON COLUMN ai_characters.can_fetch_news IS 'このAIがニュースを取得して投稿できるか';
COMMENT ON COLUMN ai_characters.news_fetch_probability IS '新規投稿時にニュースを取得する確率（0.0-1.0）';
COMMENT ON COLUMN ai_characters.news_topics IS 'このAIが興味を持つニュースのトピック（検索キーワードリスト）';
