'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import AgentChat from '@/components/AgentChat';
import AgentStatus from '@/components/AgentStatus';
import FooterNav from '@/components/FooterNav';

interface Agent {
  id: string;
  user_id: string;
  name: string;
  personality: {
    positive: number;
    talkative: number;
    curious: number;
  };
  level: number;
  experience: number;
  appearance_stage: number;
  last_active_at: number;
  is_outside: boolean;
  created_at: number;
}

export default function HomePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAgent();
  }, []);

  const initAgent = async () => {
    try {
      const userId = getUserId();
      const res = await fetch(`/api/agents?userId=${userId}`);
      const data = await res.json();
      setAgent(data);
    } catch (error) {
      console.error('Failed to init agent:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-red-600">エージェントの作成に失敗しました</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
      {/* ヘッダー（固定） */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 text-center">キャラと共に</h1>
        </div>
      </header>

      {/* メインコンテンツ（スクロール可能） - フッター(64px) + 入力欄(72px) = 136px分の余白 */}
      <main className="flex-1 overflow-y-auto pb-36">
        <div className="max-w-7xl mx-auto p-2 md:p-4">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {/* キャラクターステータス */}
            <div className="w-full md:w-80 flex-shrink-0">
              <AgentStatus agent={agent} onUpdate={initAgent} />
            </div>
            
            {/* チャット */}
            <div className="flex-1 min-w-0">
              <AgentChat agent={agent} />
            </div>
          </div>
        </div>
      </main>

      {/* フッターナビゲーション */}
      <FooterNav />
    </div>
  );
}
