# AI Living Lab

AI Living Lab は、**カメラ・マイク・音声認識（Whisper）・画像解析（Vision）・Chat** を組み合わせた  
軽量なマルチモーダル AI アプリです。

Next.js（App Router）を使用し、以下の 2 つの UI コンポーネントだけで動作します：

- `CameraView.tsx`（カメラ ON/OFF + 撮影 + Vision）
- `Recorder.tsx`（マイク ON/OFF + 録音 + Whisper + Chat）

バックエンド API は 3 つのみ：

- `/api/chat`
- `/api/transcribe`
- `/api/vision`

---

## 🚀 機能一覧

### 🎥 カメラ機能（CameraView）
- カメラ ON/OFF 切り替え
- カメラ映像を `<video>` に表示
- 撮影して画像を取得
- GPT-4o Vision に送信して解析
- 解析結果を画面に表示

### 🎤 マイク機能（Recorder）
- マイク ON/OFF 切り替え
- 音声録音（MediaRecorder）
- Whisper API による文字起こし
- Chat API による返答生成
- 返答を画面に表示

---

## 📁 ディレクトリ構成

```
app/
  page.tsx
  api/
    chat/
      route.ts         ← Chat API（テキスト → GPT）
    transcribe/
      route.ts         ← Whisper API（音声 → テキスト）
    vision/
      route.ts         ← Vision API（画像 → GPT）

components/
  CameraView.tsx       ← カメラ ON/OFF + 撮影 + Vision
  Recorder.tsx         ← マイク ON/OFF + 録音 + Whisper + Chat

lib/
  recorder.ts          ← MediaRecorder ラッパー
  whisper.ts           ← Whisper API 呼び出し
  chat.ts              ← Chat API 呼び出し
  vision.ts            ← Vision API 呼び出し
  settings.ts          ← API キー管理
```

---

## 🧩 主要コンポーネント

### `CameraView.tsx`
- カメラ ON/OFF
- 映像表示
- 撮影して画像を Blob 化
- Vision API に送信
- 解析結果を表示

### `Recorder.tsx`
- マイク ON/OFF
- 録音開始/停止
- Whisper API に送信
- Chat API に送信
- 返答を表示

---

## 🔧 API（サーバー側）

### `/api/transcribe`
- 音声（Blob）を Whisper に送信
- テキストを返す

### `/api/chat`
- テキストを GPT-4o に送信
- 返答を返す

### `/api/vision`
- 画像（Blob）を GPT-4o Vision に送信
- 解析結果を返す

---

## 🔑 API キー設定

`lib/settings.ts` に API キーを保存し、  
設定画面から入力できるようになっています。

---

## ▶️ 起動方法

```
npm install
```

```
npm run dev
```

ブラウザで  
http://localhost:3000  
にアクセス。

---

## 🎥 動作イメージ

1. **カメラ ON** → 映像が表示  
2. **撮影して解析** → GPT-4o が画像を説明  
3. **マイク ON** → 録音開始  
4. **音声を話す** → Whisper → Chat → 返答表示  

---

## 🧠 今後の拡張案

- Vision + Whisper を統合して「見ながら話す AI」
- 動画をフレーム解析して GPT に送る
- Vision の結果を ChatUI に統合
