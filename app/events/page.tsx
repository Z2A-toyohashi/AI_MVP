'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';

interface Event {
  id: string;
  type: string;
  content: string;
  created_at: number;
  is_read: boolean;
}

interface Agent {
  id: string;
  name: string;
  character_image_url?: string;
}

export default function EventsPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const userId = getUserId();
      const agentRes = await fetch(`/api/agents?userId=${userId}`);
      const agentData = await agentRes.json();
      setAgent(agentData);

      if (agentData?.id) {
        const eventsRes = await fetch(`/api/events?agentId=${agentData.id}`);
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      meet: '👋',
      talk: '💬',
      fight: '⚔️',
      explore: '🌐',
      learn: '📔',
    };
    return icons[type] || '✨';
  };

  const getEventTitle = (type: string) => {
    const titles: Record<string, string> = {
      meet: '出会い',
      talk: '会話',
      fight: '議論',
      explore: '掲示板での活動',
      learn: '今日の日記',
    };
    return titles[type] || 'イベント';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'たった今';
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '昨日';
    if (days < 7) return `${days}日前`;
    
    // 日付表示
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  const formatFullDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日（${weekday}）`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 pb-16">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800 text-center">📔 {agent?.name}の日記</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-6">
        {/* キャラクター情報 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            {agent?.character_image_url ? (
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                <img 
                  src={agent.character_image_url} 
                  alt={agent.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-2xl flex-shrink-0">
                🐣
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-800">{agent?.name}の記録</h2>
              <p className="text-sm text-gray-500">主人との日々、掲示板での出来事</p>
            </div>
          </div>
        </div>

        {/* イベント一覧 */}
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-gray-300 mb-4">
                <div className="text-6xl mb-4">📖</div>
              </div>
              <p className="text-gray-400 text-lg mb-2">まだ日記がありません</p>
              <p className="text-sm text-gray-500">
                主人と会話したり、レベルが上がると<br />
                日記が書かれるようになります
              </p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`bg-white rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg ${
                  event.is_read ? '' : 'ring-2 ring-purple-300'
                }`}
              >
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getEventIcon(event.type)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-800">{getEventTitle(event.type)}</h3>
                        <p className="text-xs text-gray-500">{formatFullDate(event.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(event.created_at)}</p>
                      {!event.is_read && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                          NEW
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* コンテンツ */}
                <div className="px-6 py-5">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {event.content}
                  </p>
                </div>

                {/* フッター（日記タイプの場合） */}
                {event.type === 'learn' && (
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      ✨ この日の思い出
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* フッターナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
          <a href="/" className="flex flex-col items-center justify-center flex-1 text-gray-600 hover:text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs">チャット</span>
          </a>
          <a href="/board" className="flex flex-col items-center justify-center flex-1 text-gray-600 hover:text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span className="text-xs">掲示板</span>
          </a>
          <a href="/events" className="flex flex-col items-center justify-center flex-1 text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-xs">日記</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
