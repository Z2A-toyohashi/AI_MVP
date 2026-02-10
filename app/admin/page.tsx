'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRecords } from '@/lib/storage';
import type { RecordData } from '@/lib/storage';

export default function AdminPage() {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'audio' | 'image'>('all');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getRecords();
      setRecords(data.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('このレコードを削除しますか？')) return;

    try {
      const res = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setRecords(records.filter(r => r.id !== id));
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredRecords = records.filter(r => 
    filter === 'all' || r.type === filter
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">管理画面</h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← ホームに戻る
          </Link>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${
                filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              すべて ({records.length})
            </button>
            <button
              onClick={() => setFilter('audio')}
              className={`px-4 py-2 rounded ${
                filter === 'audio' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              音声 ({records.filter(r => r.type === 'audio').length})
            </button>
            <button
              onClick={() => setFilter('image')}
              className={`px-4 py-2 rounded ${
                filter === 'image' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              画像 ({records.filter(r => r.type === 'image').length})
            </button>
          </div>
        </div>

        {/* データ一覧 */}
        {loading ? (
          <div className="text-center py-12">読み込み中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            データがありません
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                      record.type === 'audio' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {record.type === 'audio' ? '🎤 音声' : '📷 画像'}
                    </span>
                    <p className="text-sm text-gray-500 mt-2">
                      {new Date(record.timestamp).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    削除
                  </button>
                </div>

                {/* 音声データ */}
                {record.type === 'audio' && (
                  <div className="space-y-3">
                    {record.media_url && (
                      <div>
                        <audio controls className="w-full">
                          <source src={record.media_url} type="audio/webm" />
                        </audio>
                      </div>
                    )}
                    {record.transcript && (
                      <div>
                        <p className="font-semibold text-sm text-gray-700 mb-1">
                          文字起こし：
                        </p>
                        <p className="text-gray-900 bg-gray-50 p-3 rounded">
                          {record.transcript}
                        </p>
                      </div>
                    )}
                    {record.ai_response && (
                      <div>
                        <p className="font-semibold text-sm text-gray-700 mb-1">
                          AI応答：
                        </p>
                        <p className="text-gray-900 bg-blue-50 p-3 rounded">
                          {record.ai_response}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 画像データ */}
                {record.type === 'image' && (
                  <div className="space-y-3">
                    {record.media_url ? (
                      <div>
                        <img
                          src={record.media_url}
                          alt="キャプチャ画像"
                          className="max-w-md rounded border"
                          onError={(e) => {
                            console.error('画像の読み込みエラー:', record.media_url);
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">画像を読み込めません</text></svg>';
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">URL: {record.media_url}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">画像URLが保存されていません</p>
                    )}
                    {record.prompt && (
                      <div>
                        <p className="font-semibold text-sm text-gray-700 mb-1">
                          プロンプト：
                        </p>
                        <p className="text-gray-900 bg-gray-50 p-3 rounded">
                          {record.prompt}
                        </p>
                      </div>
                    )}
                    {record.ai_response && (
                      <div>
                        <p className="font-semibold text-sm text-gray-700 mb-1">
                          AI解析結果：
                        </p>
                        <p className="text-gray-900 bg-purple-50 p-3 rounded">
                          {record.ai_response}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
