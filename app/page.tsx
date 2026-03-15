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
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [activeTopic, setActiveTopic] = useState<{ id: string; title: string; ends_at: number; reply_count: number } | null>(null);
  const [topicTimeLeft, setTopicTimeLeft] = useState(0);

  useEffect(() => { initAgent(); fetchActiveTopic(); }, []);

  useEffect(() => {
    if (!activeTopic) return;
    const update = () => setTopicTimeLeft(Math.max(0, activeTopic.ends_at - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeTopic]);

  const fetchActiveTopic = async () => {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setActiveTopic(data.topic || null);
    } catch (_) {}
  };

  const formatCountdown = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSaveName = async () => {
    if (!agent || !nameInput.trim() || nameInput.trim() === agent.name) {
      setEditingName(false);
      return;
    }
    if (nameInput.trim().length > 20) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, name: nameInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAgent(prev => prev ? { ...prev, ...updated } : prev);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

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

  const expNeeded = 50; // 全レベル固定50XP
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

      {/* XPバー + キャラ情報（名前インライン編集対応） */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              {editingName ? (
                <div className="flex items-center gap-1 flex-1 mr-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="flex-1 text-sm font-black text-gray-800 border-b-2 border-[#58cc02] bg-transparent focus:outline-none min-w-0"
                    maxLength={20}
                  />
                  <button onClick={handleSaveName} disabled={savingName || !nameInput.trim()} className="text-[#58cc02] font-black text-xs px-2 py-1 rounded-lg bg-[#f0fce4] flex-shrink-0">
                    {savingName ? '...' : '保存'}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-gray-400 text-xs px-1 flex-shrink-0">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="font-black text-gray-800 text-sm truncate">{agent.name}</span>
                  <button
                    onClick={() => { setNameInput(agent.name); setEditingName(true); }}
                    className="flex-shrink-0 text-gray-400 hover:text-[#58cc02] transition-colors"
                    aria-label="名前を編集"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}
              <span className="text-xs font-bold text-[#ff9600] ml-2 flex-shrink-0">理解度 {agent.level}</span>
            </div>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${expPct}%` }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-gray-400 font-bold">
                {nextMilestone ? `理解度${nextMilestone.level}で${nextMilestone.label}` : 'あなたのことを深く理解している'}
              </span>
              <span className="text-[10px] text-gray-400 font-bold">{agent.experience}/{expNeeded} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* チャットエリア */}
      <main className="flex-1 overflow-hidden" style={{ paddingBottom: '64px' }}>
        {activeTopic && topicTimeLeft > 0 && (
          <a href="/board" className="block mx-4 mt-3 rounded-2xl px-4 py-3 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ff4b4b, #ff9600)', boxShadow: '0 3px 0 #cc3300' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black text-white/80 bg-white/20 px-2 py-0.5 rounded-full">🔴 今のお題</span>
                  <span className="text-[10px] font-black text-white/70">残り {formatCountdown(topicTimeLeft)}</span>
                </div>
                <p className="font-black text-white text-sm leading-snug truncate">{activeTopic.title}</p>
                <p className="text-[10px] text-white/70 font-bold mt-0.5">💬 {activeTopic.reply_count || 0}件の意見 · タップして参加</p>
              </div>
              <svg className="w-4 h-4 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${Math.max(0, (topicTimeLeft / (3 * 60 * 60 * 1000)) * 100)}%` }} />
            </div>
          </a>
        )}
        <div className="h-full max-w-lg mx-auto">
          <AgentChat agent={agent} onLevelUp={initAgent} />
        </div>
      </main>

      <FooterNav />
    </div>
  );
}
