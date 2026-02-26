'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import AgentChat from '@/components/AgentChat';
import AgentStatus from '@/components/AgentStatus';

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

export default function AgentPage() {
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
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col overflow-hidden">
      {/* ヘッダー（固定） */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-600 hover:text-gray-800">← SNS</a>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">AIと共に</h1>
          </div>
          <a 
            href="/events" 
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            帰還ログ →
          </a>
        </div>
      </header>

      {/* メインコンテンツ（固定高さ） */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <div className="w-full h-full flex flex-col md:flex-row max-w-7xl mx-auto p-2 md:p-4 gap-4 md:gap-6">
          {/* キャラクターステータス（固定・スクロールなし） */}
          <div className="w-full md:w-80 flex-shrink-0 overflow-hidden">
            <AgentStatus agent={agent} onUpdate={initAgent} />
          </div>
          
          {/* チャット（チャット履歴のみスクロール） */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <AgentChat agent={agent} />
          </div>
        </div>
      </main>
    </div>
  );
}
