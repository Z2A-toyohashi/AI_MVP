'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import AgentChat from '@/components/AgentChat';
import FooterNav from '@/components/FooterNav';
import Header from '@/components/Header';

interface Agent {
  id: string;
  user_id: string;
  name: string;
  personality: { positive: number; talkative: number; curious: number; creative?: number };
  level: number;
  experience: number;
  appearance_stage: number;
  last_active_at: number;
  is_outside: boolean;
  created_at: number;
  character_image_url?: string;
  can_post_to_sns?: boolean;
}

export default function HomePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { initAgent(); }, []);

  const initAgent = async () => {
    try {
      const userId = getUserId();
      // usersテーブルへの登録を確実に行う（外部キー制約対策）
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const res = await fetch(`/api/agents?userId=${userId}`);
      const data = await res.json();
      if (data && data.id) {
        setAgent(data); // idがある場合のみ更新（エラーレスポンスで上書きしない）
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="text-6xl animate-bounce">🥚</div>
        <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-6 p-8">
        <div className="text-6xl">😢</div>
        <p className="text-gray-700 font-bold text-lg text-center">エージェントの作成に失敗しました</p>
        <button onClick={() => window.location.reload()} className="btn-duo btn-duo-green">
          もう一度試す
        </button>
      </div>
    );
  }

  const expNeeded = agent.level * 30;
  const expPct = Math.min((agent.experience / expNeeded) * 100, 100);

  const getNextMilestone = (level: number) => {
    if (level < 3) return { level: 3, label: '見た目が変わる' };
    if (level < 5) return { level: 5, label: '掲示板解放' };
    if (level < 7) return { level: 7, label: 'さらに進化' };
    if (level < 9) return { level: 9, label: '最終形態' };
    return null;
  };
  const nextMilestone = getNextMilestone(agent.level);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header agent={agent} onAgentUpdate={(updated) => setAgent(prev => prev ? { ...prev, ...updated } : prev)} />

      {/* XPバー + キャラ情報（アイコンなし・コンパクト） */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-black text-gray-800 text-sm truncate">{agent.name}</span>
              <span className="text-xs font-bold text-[#ff9600] ml-2 flex-shrink-0">Lv.{agent.level}</span>
            </div>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${expPct}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400 font-bold">
                {nextMilestone ? `Lv.${nextMilestone.level}で${nextMilestone.label}` : '最大レベル到達！'}
              </span>
              <span className="text-[10px] text-gray-400 font-bold">{agent.experience}/{expNeeded} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* チャットエリア */}
      <main className="flex-1 overflow-hidden" style={{ paddingBottom: '64px' }}>
        <div className="h-full max-w-lg mx-auto">
          <AgentChat agent={agent} onLevelUp={initAgent} />
        </div>
      </main>

      <FooterNav />
    </div>
  );
}
