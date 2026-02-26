# 技術構成（MVP最適化）

## 全体方針

- **1〜2週間で動く**
- **スケールしない前提でOK**
- **AIの賢さより体験優先**

---

# ① 全体アーキテクチャ

```
[フロント（Webアプリ）]
        ↓
[APIサーバー]
        ↓
[DB] + [LLM]
```

＋

```
[バッチ処理（AI同士の交流）]
```

---

# ② フロントエンド

## 技術

- Next.js（App Router）
- Vercelデプロイ

## 理由

- 爆速で作れる
- UI修正が簡単
- 認証も楽

---

## 画面（MVP最小）

### ① ホーム

- キャラ表示
- 会話入力（テキスト1本でOK）

### ② ログ

- 帰還レポート一覧

👉 これだけでいい

---

# ③ バックエンド

## 技術

- Node.js（Next.js API or Express）
- Supabase or Firebase

👉 Supabase推奨（楽）

---

## DB設計（最低限）

### users

- id

### agents

- id
- user_id
- personality（JSON）
- level
- last_active_at

---

### conversations

- id
- agent_id
- role（user / ai）
- content
- created_at

---

### events（超重要）

- id
- agent_id
- type（meet / talk / fight など）
- content（ストーリー）
- created_at

---

### encounters（AI同士）

- id
- agent_a_id
- agent_b_id
- summary

---

# ④ LLM（AI部分）

## 技術

- OpenAI API or Claude

---

## 使い方（重要）

### ❌ やりがち

- 高度な人格生成
- 長文生成

### ✅ MVP

👉 **短く・雑でいい**

---

## ① 会話生成

入力：

- ユーザー発言
- personality（簡易）

出力：

- 1〜2文

---

## ② 性格更新

ルールベースでOK：

例：

- ネガティブ発言多い → ネガティブ++
- 会話量多い → おしゃべり++

👉 LLMいらないレベル

---

## ③ 交流イベント生成（最重要）

入力：

- agent A personality
- agent B personality

出力：

👉 **“くだらない会話ログ”**

例プロンプト：

「2つの性格の違うキャラが雑談して、少し感情が動く短いストーリーを書け」

---

# ⑤ バッチ処理（コア機能）

## 技術

- cron（Vercel cron or Supabase Edge Functions）

---

## 処理内容

1. ランダムでAIをペアリング
2. LLMで交流生成
3. eventsに保存
4. 各ユーザーに紐付け

---

## 頻度

- 1日1回でOK

👉 最初はこれで十分

---

# ⑥ リアルタイム性

不要

👉 むしろ「遅延」が価値

- 帰ってくるまでの時間がワクワクになる

---

# ⑦ 認証

- Supabase Auth or Firebase Auth

👉 GoogleログインだけでOK

---

# ⑧ デプロイ構成

- フロント：Vercel
- バックエンド：Vercel or Supabase
- DB：Supabase

👉 全部サーバーレスでOK

---

# ⑨ 開発優先順位（超重要）

## Day1〜2

- 会話UI
- AI応答

---

## Day3〜4

- personality保存
- 簡易成長

---

## Day5〜6

- バッチでAI同士交流
- イベント生成

---

## Day7

- 帰還ログ表示

---

👉 **ここでリリース**

---

# ⑩ 絶対にやらないこと

- ❌ 音声（最初はいらない）
- ❌ 高精度AI
- ❌ リアルタイム通信
- ❌ 複雑なキャラ生成
- ❌ 綺麗なUI