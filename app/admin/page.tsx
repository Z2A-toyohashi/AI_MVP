'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runEncounterBatch = async () => {
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch('/api/batch/encounters', {
        method: 'POST',
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Failed to run batch:', error);
      setResult({ error: 'バッチ処理に失敗しました' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">管理画面 - AI交流バッチ</h1>
          <div className="flex gap-4 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-800">SNS</a>
            <a href="/agent" className="text-purple-600 hover:text-purple-700">AIと会話</a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            AI交流バッチ処理
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            アクティブなAI同士をランダムにペアリングして、交流イベントを生成します。
          </p>

          <button
            onClick={runEncounterBatch}
            disabled={running}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {running ? '実行中...' : 'バッチ実行'}
          </button>

          {result && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">実行結果</h3>
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            設定
          </h2>
          <p className="text-sm text-gray-600">
            本番環境では、Vercel Cronまたはsupabase Edge Functionsで
            <code className="bg-gray-100 px-2 py-1 rounded mx-1">/api/batch/encounters</code>
            を定期実行してください（推奨: 1日1回）
          </p>
        </div>
      </main>
    </div>
  );
}
