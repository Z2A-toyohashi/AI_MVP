'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  saveOpenAIApiKey,
  getOpenAIApiKey,
  clearOpenAIApiKey,
  hasOpenAIApiKey,
} from '@/lib/settings';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 初回ロード時に localStorage から読み込み
  useEffect(() => {
    const key = getOpenAIApiKey();
    if (key) setApiKey(key);
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) return;

    saveOpenAIApiKey(apiKey.trim());
    setSaved(true);

    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    if (confirm('APIキーを削除しますか？')) {
      clearOpenAIApiKey();
      setApiKey('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          ← ホームに戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-center mb-2">⚙️ 設定</h1>
      <p className="text-center text-gray-600 mb-8">
        OpenAI APIキーの設定
      </p>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">✅ APIキーを保存しました</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">OpenAI APIキー</h2>

        <label className="block text-sm font-semibold mb-2">APIキー</label>

        <div className="relative mb-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full border rounded-lg p-3 pr-24 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />

          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
          >
            {showKey ? '隠す' : '表示'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          APIキーはブラウザのローカルストレージに保存されます（サーバーには送信されません）
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg"
          >
            保存
          </button>

          {hasOpenAIApiKey() && (
            <button
              onClick={handleClear}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg"
            >
              削除
            </button>
          )}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-3">📖 APIキーの取得方法</h3>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              OpenAI Platform
            </a>
            にアクセス
          </li>
          <li>ログインまたはアカウント作成</li>
          <li>「Create new secret key」をクリック</li>
          <li>生成されたAPIキーをコピーして上記に貼り付け</li>
        </ol>
      </div>

      <div className="bg-yellow-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">⚠️ 注意事項</h3>
        <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
          <li>APIキーは他人と共有しないでください</li>
          <li>OpenAI APIの利用には料金が発生します</li>
          <li>Whisper API: 約$0.006/分</li>
          <li>GPT-4o API: 約$0.005/1000トークン（入力）</li>
          <li>
            使用量は
            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              OpenAI Usage
            </a>
            で確認できます
          </li>
        </ul>
      </div>
    </div>
  );
}
