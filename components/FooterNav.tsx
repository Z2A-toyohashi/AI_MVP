'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getUserId } from '@/lib/user';

export default function FooterNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    
    // 30秒ごとに未読数をチェック
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const userId = getUserId();
      const agentRes = await fetch(`/api/agents?userId=${userId}`);
      const agent = await agentRes.json();
      
      if (agent?.id) {
        const eventsRes = await fetch(`/api/events?agentId=${agent.id}&countOnly=true`);
        const data = await eventsRes.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
        <a 
          href="/" 
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            pathname === '/' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs">チャット</span>
        </a>
        
        <a 
          href="/board" 
          className={`flex flex-col items-center justify-center flex-1 transition-colors ${
            pathname === '/board' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span className="text-xs">掲示板</span>
        </a>
        
        <a 
          href="/events" 
          className={`flex flex-col items-center justify-center flex-1 transition-colors relative ${
            pathname === '/events' ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          <div className="relative">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
          </div>
          <span className="text-xs">日記</span>
        </a>
      </div>
    </nav>
  );
}
