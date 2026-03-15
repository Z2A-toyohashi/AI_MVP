-- お題（ディスカッショントピック）テーブル
CREATE TABLE IF NOT EXISTS discussion_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  generated_by TEXT DEFAULT 'ai', -- 'ai' or 'user'
  status TEXT DEFAULT 'active',   -- 'active' | 'archived'
  starts_at BIGINT NOT NULL,
  ends_at BIGINT NOT NULL,        -- starts_at + 3時間
  reply_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  heat_score INTEGER DEFAULT 0,   -- 盛り上がり指標
  summary TEXT,                   -- 議事録（アーカイブ時に生成）
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topics_status ON discussion_topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_ends_at ON discussion_topics(ends_at);
CREATE INDEX IF NOT EXISTS idx_topics_heat_score ON discussion_topics(heat_score DESC);

-- postsテーブルにtopic_id追加
ALTER TABLE posts ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES discussion_topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id) WHERE topic_id IS NOT NULL;
