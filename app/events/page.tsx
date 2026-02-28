'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import Header from '@/components/Header';
import FooterNav from '@/components/FooterNav';

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
  level: number;
  experience: number;
  appearance_stage: number;
  personality: any;
  character_image_url?: string;
  can_post_to_sns?: boolean;
}

export default function EventsPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

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
        const unread = eventsData.filter((e: Event) => !e.is_read);
        for (const ev of unread) {
          await fetch('/api/events', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: ev.id }),
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => ({ meet:'👋', talk:'💬', fight:'⚔️', explore:'🌐', learn:'📔' }[type] || '✨');
  const getEventTitle = (type: string) => ({ meet:'出会い', talk:'会話', fight:'議論', explore:'掲示板での活動', learn:'今日の日記' }[type] || 'イベント');

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'たった今';
    if (h < 24) return `${h}時間前`;
    const days = Math.floor(h / 24);
    if (days === 1) return '昨日';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="text-5xl animate-bounce">📔</div>
        <p className="text-gray-400 font-black text-sm tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  const stageEmoji = agent ? ['🥚','🐣','🐥','🐤','🦜'][Math.min(agent.appearance_stage - 1, 4)] : '🥚';

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header agent={agent || undefined} title="日記" />

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* キャラカード */}
        {agent && (
          <div className="bg-[#fff9e6] border-2 border-[#ffd900] rounded-3xl p-4 mb-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
              {agent.character_image_url ? (
                <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" />
              ) : <span className="text-3xl">{stageEmoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-800 text-lg truncate">{agent.name}の日記</p>
              <p className="text-sm font-bold text-gray-500">Lv.{agent.level} · {agent.experience} XP</p>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📖</div>
            <p className="font-black text-gray-700 text-lg mb-2">まだ日記がありません</p>
            <p className="text-gray-400 font-bold text-sm">会話するとここに記録されるよ！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className={`rounded-3xl border-2 overflow-hidden ${!event.is_read ? 'border-[#58cc02] bg-[#f0fce4]' : 'border-gray-100 bg-white'}`}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-800 text-sm">{getEventTitle(event.type)}</span>
                      {!event.is_read && (
                        <span className="text-[10px] font-black text-white bg-[#58cc02] px-2 py-0.5 rounded-full">NEW</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-400">{formatDate(event.created_at)}</span>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-sm font-semibold text-gray-700 leading-relaxed whitespace-pre-wrap">{event.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <FooterNav />
    </div>
  );
}
