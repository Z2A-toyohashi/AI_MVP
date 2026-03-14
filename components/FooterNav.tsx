'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUserId } from '@/lib/user';

export default function FooterNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const userId = getUserId();
      const agentRes = await fetch(`/api/agents?userId=${userId}`);
      const agent = await agentRes.json();
      if (agent?.id) {
        // 日記（events）未読
        const eventsRes = await fetch(`/api/events?agentId=${agent.id}&countOnly=true`);
        const eventsData = await eventsRes.json();
        setUnreadCount(eventsData.unreadCount || 0);
        // ホームチャット（conversations）未読
        const chatRes = await fetch(`/api/conversations?agentId=${agent.id}&unreadCount=true`);
        const chatData = await chatRes.json();
        setUnreadChatCount(chatData.unreadCount || 0);
      }
      const dmRes = await fetch(`/api/agent-dm?unreadCount=true&userId=${userId}`);
      const dmData = await dmRes.json();
      setUnreadDmCount(dmData.unreadCount || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const items = [
    {
      href: '/',
      label: 'ホーム',
      badge: unreadChatCount,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? '#58cc02' : 'none'} stroke={active ? '#58cc02' : '#afafaf'} strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      href: '/events',
      label: '日記',
      badge: unreadCount,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? '#58cc02' : 'none'} stroke={active ? '#58cc02' : '#afafaf'} strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    // 中央: 交流（強調）
    {
      href: '/board',
      label: '交流',
      badge: unreadDmCount,
      center: true,
      icon: (_active: boolean) => (
        <svg className="w-7 h-7" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: '/agent',
      label: 'キャラ',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? '#58cc02' : 'none'} stroke={active ? '#58cc02' : '#afafaf'} strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/settings',
      label: '設定',
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? '#58cc02' : 'none'} stroke={active ? '#58cc02' : '#afafaf'} strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-50 h-16">
      <div className="max-w-lg mx-auto flex items-end h-full">
        {items.map((item) => {
          const active = pathname === item.href;

          if ((item as any).center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-end pb-2 relative"
              >
                {/* 飛び出すボタン */}
                <div className="relative -translate-y-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg relative"
                    style={{ background: 'linear-gradient(135deg, #58cc02, #3d8f00)', boxShadow: '0 4px 0 #2d6a00, 0 6px 16px rgba(88,204,2,0.4)' }}
                  >
                    {item.icon(active)}
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff4b4b] rounded-full flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">{item.badge > 9 ? '9+' : item.badge}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-black text-[#58cc02] -mt-1">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-colors"
            >
              <div className="relative">
                {item.icon(active)}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4b4b] rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">{item.badge > 9 ? '9+' : item.badge}</span>
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-black ${active ? 'text-[#58cc02]' : 'text-[#afafaf]'}`}>
                {item.label}
              </span>
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#58cc02] rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
