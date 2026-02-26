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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-600 hover:text-gray-800">← SNS</a>
            <h1 className="text-2xl font-bold text-gray-800">帰還ログ</h1>
          </div>
          <a 
            href="/agent" 
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            ← AIと会話
          </a>
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
    </div>
  );
}
