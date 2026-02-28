-- ユーザーの表示名カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
