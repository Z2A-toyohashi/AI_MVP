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
    <div className="h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col overflow-hidden pb-16">
      {/* ヘッダー（固定） */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 text-center">AIと共に</h1>
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

      {/* フッターナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
          <a href="/" className="flex flex-col items-center justify-center flex-1 text-purple-600 transition-colors">
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
          <a href="/events" className="flex flex-col items-center justify-center flex-1 text-gray-600 hover:text-purple-600 transition-colors">
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
