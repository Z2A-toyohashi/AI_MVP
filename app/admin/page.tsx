'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRecords } from '@/lib/storage';
import type { RecordData } from '@/lib/storage';

type TabType = 'data' | 'analytics';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('data');
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

  // 分析用の関数
  const getHourlyUsage = () => {
    const hourly = new Array(24).fill(0);
    records.forEach(record => {
      const hour = new Date(record.timestamp).getHours();
      hourly[hour]++;
    });
    return hourly;
  };

  const getDailyUsage = () => {
    const daily: { [key: string]: number } = {};
    records.forEach(record => {
      const date = new Date(record.timestamp).toLocaleDateString('ja-JP');
      daily[date] = (daily[date] || 0) + 1;
    });
    return Object.entries(daily).sort((a, b) => 
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  };

  const getAverageLength = () => {
    const audioRecords = records.filter(r => r.type === 'audio' && r.transcript);
    if (audioRecords.length === 0) return 0;
    const total = audioRecords.reduce((sum, r) => sum + (r.transcript?.length || 0), 0);
    return Math.round(total / audioRecords.length);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'タイプ', '日時', '文字起こし', 'AI応答', 'プロンプト'];
    const rows = records.map(r => [
      r.id,
      r.type,
      new Date(r.timestamp).toLocaleString('ja-JP'),
      r.transcript || '',
      r.ai_response || '',
      r.prompt || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ai-living-lab-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const json = JSON.stringify(records, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ai-living-lab-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const hourlyUsage = getHourlyUsage();
  const dailyUsage = getDailyUsage();
  const avgLength = getAverageLength();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">管理画面</h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← ホームに戻る
          </Link>
        </div>

        {/* タブ */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('data')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'data'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 データ一覧
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 分析ダッシュボード
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">読み込み中...</div>
        ) : (
          <>
            {/* データ一覧タブ */}
            {activeTab === 'data' && (
              <>
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
                {filteredRecords.length === 0 ? (
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
                          <div className="flex-1">
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
                            <p className="text-xs text-gray-400 mt-1">
                              ID: {record.id}
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
              </>
            )}

            {/* 分析ダッシュボードタブ */}
            {activeTab === 'analytics' && (
              <>
                {/* サマリー */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">総記録数</p>
                    <p className="text-3xl font-bold">{records.length}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">音声記録</p>
                    <p className="text-3xl font-bold text-green-600">
                      {records.filter(r => r.type === 'audio').length}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">画像記録</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {records.filter(r => r.type === 'image').length}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 mb-1">平均文字数</p>
                    <p className="text-3xl font-bold text-blue-600">{avgLength}</p>
                  </div>
                </div>

                {/* エクスポート */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">データエクスポート</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={exportToCSV}
                      className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      📊 CSVダウンロード
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      📄 JSONダウンロード
                    </button>
                  </div>
                </div>

                {/* 時間帯別利用状況 */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">時間帯別利用状況</h2>
                  <div className="flex items-end gap-1 h-48">
                    {hourlyUsage.map((count, hour) => (
                      <div key={hour} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{
                            height: `${Math.max(count / Math.max(...hourlyUsage) * 100, 2)}%`,
                          }}
                          title={`${hour}時: ${count}回`}
                        />
                        <p className="text-xs mt-1">{hour}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 日別利用状況 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">日別利用状況</h2>
                  {dailyUsage.length === 0 ? (
                    <p className="text-gray-500">データがありません</p>
                  ) : (
                    <div className="space-y-2">
                      {dailyUsage.map(([date, count]) => (
                        <div key={date} className="flex items-center gap-4">
                          <p className="w-32 text-sm">{date}</p>
                          <div className="flex-1 bg-gray-200 rounded h-8 relative">
                            <div
                              className="bg-green-500 h-full rounded flex items-center px-3 text-white text-sm font-semibold"
                              style={{
                                width: `${Math.max((count / Math.max(...dailyUsage.map(d => d[1]))) * 100, 10)}%`,
                              }}
                            >
                              {count}回
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
