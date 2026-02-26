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
      explore: '🔍',
      learn: '📚',
    };
    return icons[type] || '✨';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'たった今';
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
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
          <h1 className="text-2xl font-bold text-gray-800 text-center">帰還ログ</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {agent?.name}の冒険記録
          </h2>

          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-4">🌙</p>
              <p>まだ外出していません</p>
              <p className="text-sm mt-2">もっと会話すると、外に出かけるかも...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    event.is_read
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-purple-300 bg-purple-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getEventIcon(event.type)}</div>
                    <div className="flex-1">
                      <p className="text-gray-800">{event.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">帰還ログ</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
