# MVPpart2 移行ガイド

## 変更概要

**旧**: 匿名SNS（人間とAIが投稿で交流）
**新**: AIキャラクター共存（1対1の関係性 + AI同士の交流）

## 移行手順

### 1. データベース移行

Supabaseダッシュボードで実行：

```sql
-- migration-mvp2-schema.sql を実行
-- agents, conversations, events, encounters テーブルが作成される
```

### 2. 既存データの扱い

旧システムのデータ（posts, ai_characters等）は残りますが、新システムでは使用しません。
必要に応じてバックアップ後、削除可能です。

### 3. 環境変数

変更なし。既存の`.env`をそのまま使用できます。

### 4. コード変更

主要な変更ファイル：

#### 新規作成
- `app/page.tsx` - ホーム画面（完全書き換え）
- `app/events/page.tsx` - 帰還ログ
- `app/admin/page.tsx` - 管理画面（簡素化）
- `app/api/agents/route.ts` - エージェント管理
- `app/api/conversations/route.ts` - 会話API
- `app/api/events/route.ts` - イベントAPI
- `app/api/batch/encounters/route.ts` - AI交流バッチ
- `components/AgentStatus.tsx` - AI状態表示
- `components/AgentChat.tsx` - 会話UI
- `lib/agent-chat.ts` - AI応答生成
- `lib/encounter-generator.ts` - 交流ストーリー生成

#### 不要になったファイル（削除可能）
- `app/chat/page.tsx`
- `app/feedback/page.tsx`
- `app/settings/page.tsx`
- `app/admin/ai-characters/page.tsx`
- `app/admin/metrics/page.tsx`
- `app/admin/posts/page.tsx`
- `app/api/ai-check/route.ts`
- `app/api/generate-image/route.ts`
- `components/PostInput.tsx`
- `components/PostItem.tsx`
- `lib/ai-logic.ts`
- `lib/ai-manager.ts`

### 5. 動作確認

```bash
npm run dev
```

1. `http://localhost:3000` でホーム画面が表示される
2. AIと会話できる
3. `/events` で帰還ログが表示される
4. `/admin` でバッチ処理が実行できる

### 6. バッチ処理の設定

#### 開発環境
管理画面から手動実行

#### 本番環境
Vercel Cronまたはsupabase Edge Functionsで自動実行

**Vercel Cron** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/batch/encounters",
    "schedule": "0 3 * * *"
  }]
}
```

## 主な機能の対応表

| 旧機能 | 新機能 | 状態 |
|--------|--------|------|
| 投稿タイムライン | AIとの1対1会話 | 置き換え |
| AI自動投稿 | AI応答生成 | 置き換え |
| リアクション | （なし） | 削除 |
| スレッド返信 | （なし） | 削除 |
| 音声入力 | （なし） | 削除（将来追加可能） |
| 画像生成 | （なし） | 削除（将来追加可能） |
| AIキャラクター管理 | エージェント自動生成 | 簡素化 |
| メトリクス | （なし） | 削除 |
| （なし） | 帰還ログ | 新規 |
| （なし） | AI同士の交流 | 新規 |

## トラブルシューティング

### エージェントが作成されない

1. `migration-mvp2-schema.sql`が実行されているか確認
2. Supabaseの接続情報が正しいか確認
3. ブラウザのコンソールでエラーを確認

### AI応答が返ってこない

1. `OPENAI_API_KEY`が設定されているか確認
2. OpenAI APIの残高を確認
3. `/api/conversations`のログを確認

### バッチ処理が動かない

1. アクティブなエージェントが2つ以上あるか確認
2. 管理画面の実行結果を確認
3. `/api/batch/encounters`のログを確認

## ロールバック

旧システムに戻す場合：

1. Gitで以前のコミットに戻す
2. 新しいテーブル（agents, conversations, events, encounters）は削除可能

## 次のステップ

MVP2が動作したら：

1. ユーザーテスト
2. 帰還イベント後の再訪率を測定
3. フィードバック収集
4. 次の機能追加を検討
   - 音声入力
   - ビジュアル変化の強化
   - AI同士の関係性固定
   - 長期記憶

## サポート

問題が発生した場合は、以下を確認：

1. ブラウザのコンソールログ
2. Supabaseのログ
3. Vercelのログ（本番環境）
4. OpenAI APIの使用状況
