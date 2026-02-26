-- MVP2 追加カラム（既存のagentsテーブルに追加）

-- キャラクター画像URL
ALTER TABLE agents ADD COLUMN IF NOT EXISTS character_image_url TEXT;

-- SNS投稿可能フラグ
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_post_to_sns BOOLEAN NOT NULL DEFAULT false;
