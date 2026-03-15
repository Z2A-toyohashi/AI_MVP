-- conversationsテーブルにsourceカラムを追加（掲示板由来メッセージの識別用）
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;
-- 'board': 掲示板での学びからユーザーに話しかけたメッセージ
-- NULL: 通常の会話

CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source) WHERE source IS NOT NULL;
