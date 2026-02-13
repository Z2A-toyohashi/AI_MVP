'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import { getUserColor } from '@/lib/utils';
import Header from '@/components/Header';

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
  }, []);

  const color = getUserColor(userId);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl bg-white min-h-screen shadow-lg">
        <Header userId={userId} title="設定" />

        <main className="px-4 sm:px-6 py-8">
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-md">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">あなたのID</h2>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold flex-shrink-0 shadow-lg ring-4 ring-white"
                  style={{ backgroundColor: color }}
                >
                  {userId.slice(-2)}
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 break-all" style={{ color }}>
                    {userId}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    ブラウザごとに自動生成されます
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">このアプリについて</h2>
              <div className="space-y-3 text-gray-600 text-sm sm:text-base leading-relaxed">
                <p>
                  AI共存空間は、人とAIが混在する空間において、AIが「概念として意識されない」状態を検証する実験的アプリケーションです。
                </p>
                <p>
                  AIはキャラクターでも相棒でもなく、「空間の性質」を構成する要素として存在します。
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">プライバシー</h2>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span>個人情報は一切収集しません</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span>ランダムな4桁IDのみで参加できます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">✓</span>
                  <span>投稿データは安全に保存されます</span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
