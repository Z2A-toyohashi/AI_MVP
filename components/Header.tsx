'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface HeaderProps {
  userId: string;
  title?: string;
}

export default function Header({ userId, title = '空間' }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { label: '🏠 空間', path: '/' },
    { label: '💬 AIと1on1', path: '/chat' },
    { label: '🧪 検証について', path: '/about' },
    { label: '📝 フィードバック', path: '/feedback' },
  ];

  return (
    <header className="border-b-2 border-gray-200 sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-sm z-20 shadow-sm">
      <div className="px-4 sm:px-6 py-5 sm:py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">ID:</span>
              <span className="text-sm sm:text-base font-bold text-gray-900">{userId}</span>
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
