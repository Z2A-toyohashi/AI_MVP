'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRecords } from '@/lib/storage';
import type { RecordData } from '@/lib/storage';

export default function AnalyticsPage() {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getRecords();
      setRecords(data);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 時間帯別の利用状況
  const getHourlyUsage = () => {
    const hourly = new Array(24).fill(0);
    records.forEach(record => {
      const hour = new Date(record.timestamp).getHours();
      hourly[hour]++;
    });
    return hourly;
  };

  // 日別の利用状況
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

  // 平均文字数
  const getAverageLength = () => {
    const audioRecords = records.filter(r => r.type === 'audio' && r.transcript);
    if (audioRecords.length === 0) return 0;
    const total = audioRecords.reduce((sum, r) => sum + (r.transcript?.length || 0), 0);
    return Math.round(total / audioRecords.length);
  };

  // CSVエクスポート
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

  // JSONエクスポート
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">分析ダッシュボード</h1>
          <div className="flex gap-4">
            <Link href="/admin" className="text-blue-500 hover:underline">
              ← データ一覧
            </Link>
          </div>
        </div>

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
        </div>
      </div>
    </div>
  );
}
