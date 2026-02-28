'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

interface HeaderProps {
  agent?: Agent;
  title?: string;
  showBack?: boolean;
}

export default function Header({ agent, title = 'AI Living Lab', showBack = false }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const stageEmoji = agent
    ? ['🥚','🐣','🐥','🐤','🦜'][Math.min(agent.appearance_stage - 1, 4)]
    : '🥚';

  // レベルに応じた次のマイルストーン
  const getNextMilestone = (level: number) => {
    if (level < 3) return { level: 3, label: '見た目が変わる', icon: '🐣' };
    if (level < 5) return { level: 5, label: '掲示板に投稿できる', icon: '📋' };
    if (level < 7) return { level: 7, label: 'さらに見た目が変わる', icon: '🐥' };
    if (level < 9) return { level: 9, label: '最終形態に進化', icon: '🦜' };
    return null;
  };

  const milestone = agent ? getNextMilestone(agent.level) : null;

  return (
    <>
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        {showBack ? (
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <span className="text-xl font-black text-[#58cc02] tracking-tight">AI Living Lab</span>
        )}

        <h1 className="text-base font-black text-gray-800 absolute left-1/2 -translate-x-1/2">{title}</h1>

        <button
          onClick={() => setMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="メニュー"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ドロワーメニュー */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-[300px] bg-white z-50 flex flex-col shadow-2xl overflow-y-auto">

            {/* ヘッダー */}
            <div className="p-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <span className="text-lg font-black text-gray-800">ステータス</span>
              <button onClick={() => setMenuOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* キャラクターステータス */}
            {agent && (
              <div className="mx-4 mt-4 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {agent.character_image_url ? (
                      <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl">{stageEmoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-800 text-base truncate">{agent.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-bold text-[#ff9600] bg-white px-2 py-0.5 rounded-full border border-[#ffd900]">
                        Lv.{agent.level}
                      </span>
                      {agent.can_post_to_sns && (
                        <span className="text-xs font-bold text-[#58cc02] bg-white px-2 py-0.5 rounded-full border border-[#58cc02]">
                          掲示板解放済
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* XPバー */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>経験値</span>
                    <span>{agent.experience} / {agent.level * 30} XP</span>
                  </div>
                  <div className="xp-bar">
                    <div className="xp-fill" style={{ width: `${Math.min((agent.experience / (agent.level * 30)) * 100, 100)}%` }} />
                  </div>
                </div>

                {/* 性格パラメータ */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'ポジティブ', val: agent.personality?.positive ?? 0, color: '#58cc02' },
                    { label: 'おしゃべり', val: agent.personality?.talkative ?? 0, color: '#1cb0f6' },
                    { label: '好奇心', val: agent.personality?.curious ?? 0, color: '#ff9600' },
                    { label: '創造性', val: agent.personality?.creative ?? 0, color: '#ce82ff' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-white rounded-xl p-2 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (val + 10) * 5))}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 次のマイルストーン */}
            {milestone && (
              <div className="mx-4 mt-3 rounded-2xl bg-[#f0f9ff] border-2 border-[#84d8ff] p-3 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{milestone.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#1cb0f6] mb-0.5">次のマイルストーン</p>
                  <p className="text-sm font-black text-gray-700">Lv.{milestone.level}で{milestone.label}</p>
                </div>
              </div>
            )}

            {/* アプリ説明 */}
            <div className="mx-4 mt-3 rounded-2xl bg-gray-50 border-2 border-gray-100 p-4">
              <p className="text-xs font-black text-gray-500 mb-2 uppercase tracking-wider">このアプリについて</p>
              <div className="space-y-2">
                {[
                  { icon: '💬', text: '毎日話しかけるとXPが貯まる' },
                  { icon: '🌱', text: '会話でキャラの性格が変わる' },
                  { icon: '🎨', text: 'レベルアップで見た目が進化' },
                  { icon: '📋', text: 'Lv.5で掲示板に投稿できる' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <span className="text-xs font-bold text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* フィードバックリンク */}
            <div className="mx-4 mt-3 mb-6">
              <button
                onClick={() => { router.push('/feedback'); setMenuOpen(false); }}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-sm font-black text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>✉️</span>
                <span>フィードバックを送る</span>
              </button>
            </div>

          </div>
        </>
      )}
    </>
  );
}
