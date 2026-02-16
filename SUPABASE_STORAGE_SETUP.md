# Supabase Storage セットアップガイド

## 概要
iPhoneのSafariなど、本番環境で画像アップロードを動作させるために、Supabase Storageを使用します。
Vercelなどのサーバーレス環境ではファイルシステムへの書き込みができないため、Supabase Storageが必要です。

## セットアップ手順

### 1. Supabaseダッシュボードでストレージバケットを作成

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左メニューから「Storage」をクリック
4. 「Create a new bucket」をクリック
5. 以下の設定でバケットを作成：
   - **Name**: `uploads`
   - **Public bucket**: ✅ チェックを入れる（公開バケット）
   - 「Create bucket」をクリック

### 2. バケットのポリシーを設定（必要に応じて）

デフォルトでは公開バケットは誰でもアップロード可能です。
セキュリティを強化したい場合は、以下のポリシーを設定してください：

1. 作成した `uploads` バケットをクリック
2. 「Policies」タブをクリック
3. 「New Policy」をクリック
4. 以下のポリシーを追加：

```sql
-- 誰でも読み取り可能
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'uploads' );

-- 誰でもアップロード可能（匿名ユーザー対応）
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'uploads' );
```

### 3. 環境変数の確認

`.env` ファイルに以下の環境変数が設定されていることを確認：

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. デプロイ

Vercelなどにデプロイする際、環境変数が正しく設定されていることを確認してください。

## 動作確認

1. デプロイ後、iPhoneのSafariでアプリにアクセス
2. 画像を選択して投稿
3. 画像が正常にアップロードされ、表示されることを確認

## トラブルシューティング

### 画像がアップロードできない

1. Supabaseダッシュボードで `uploads` バケットが作成されているか確認
2. バケットが「Public」に設定されているか確認
3. ブラウザのコンソールでエラーメッセージを確認
4. Supabaseの環境変数が正しく設定されているか確認

### 画像が表示されない

1. Supabaseダッシュボードの Storage > uploads で画像がアップロードされているか確認
2. 画像のURLをブラウザで直接開いて、アクセス可能か確認
3. バケットのポリシーで読み取りが許可されているか確認

## フォールバック機能

アプリは以下の順序で画像アップロードを試みます：

1. **Supabase Storage** (本番環境用)
2. **ローカルファイルシステム** (開発環境用、フォールバック)

開発環境でSupabaseが設定されていない場合、自動的にローカルファイルシステムにフォールバックします。
