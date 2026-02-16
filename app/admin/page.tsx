'use client';

import { useEffect, useState } from 'react';
import AISettings from '@/components/admin/AISettings';
import AdminHeader from '@/components/admin/AdminHeader';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [aiDensity, setAIDensity] = useState(0);
  const [userStats, setUserStats] = useState({
    activeHumans: 0,
    totalHumans: 0,
    totalAI: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // AI密度を取得
      const postsRes = await fetch('/api/posts');
      const postsData = await postsRes.json();
      const allPosts = postsData.posts || [];
      const aiPosts = allPosts.filter((p: any) => p.author_type === 'ai');
      const density = allPosts.length > 0 ? aiPosts.length / allPosts.length : 0;
      setAIDensity(density);

      // ユーザー統計を取得
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      setUserStats({
        activeHumans: usersData.activeHumans || 0,
        totalHumans: usersData.totalHumans || 0,
        totalAI: usersData.totalAI || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 sm:mt-6 mb-8">
        {/* アカウント統計 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">アクティブユーザー</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{userStats.activeHumans}</p>
                <p className="text-xs text-gray-500 mt-1">過去1時間</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">総ユーザー数</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{userStats.totalHumans}</p>
                <p className="text-xs text-gray-500 mt-1">累計</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AIキャラクター数</p>
                <p className="text-3xl font-bold text-gray-700 mt-2">{userStats.totalAI}</p>
                <p className="text-xs text-gray-500 mt-1">登録済み</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
          </div>
        </div>

        <AISettings currentAIDensity={aiDensity} />
      </main>
    </div>
  );
}
