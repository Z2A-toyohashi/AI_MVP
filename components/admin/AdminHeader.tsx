'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { label: '⚙️ AI設定', path: '/admin' },
    { label: '📊 メトリクス', path: '/admin/metrics' },
    { label: '💬 チャットログ', path: '/admin/chat-log' },
    { label: '📝 フィードバック', path: '/admin/feedback' },
    { label: '📋 投稿ログ', path: '/admin/posts' },
  ];

  return (
    <header className="bg-white border-b-2 border-blue-200 sticky top-0 z-20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              🎛️ 管理画面
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">AI共存空間の管理と分析</p>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-4 top-[calc(100%+8px)] bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden z-40 min-w-[200px]">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  setMenuOpen(false);
                }}
                className={`w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  pathname === item.path ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </header>
  );
}
