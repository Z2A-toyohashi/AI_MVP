-- フィードバックテーブルを追加

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Enable read access for all users" ON feedback FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON feedback FOR INSERT WITH CHECK (true);
