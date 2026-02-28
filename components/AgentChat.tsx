'use client';

import { useEffect, useState, useRef } from 'react';

interface Agent {
  id: string;
  name: string;
  appearance_stage: number;
  character_image_url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'ai';
  content: string;
  created_at: number;
}

interface Props {
  agent: Agent;
  onLevelUp?: () => void;
}

export default function AgentChat({ agent, onLevelUp }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [levelUpNotification, setLevelUpNotification] = useState<{ level: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stageEmoji = ['🥚','🐣','🐥','🐤','🦜'][Math.min(agent.appearance_stage - 1, 4)];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  };

  useEffect(() => { fetchMessages(); }, [agent.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }); }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, content: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMessages();
        if (data.levelUp) {
          setLevelUpNotification({ level: data.newLevel });
          setTimeout(() => setLevelUpNotification(null), 3000);
          setTimeout(() => { onLevelUp?.(); }, 3200);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isAI = (role: string) => role === 'assistant' || role === 'ai';

  return (
    <div className="h-full flex flex-col">
      {/* レベルアップ通知 */}
      {levelUpNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-levelup bg-[#ffd900] text-gray-800 px-10 py-8 rounded-3xl shadow-2xl text-center border-4 border-[#ffb800]">
            <div className="text-5xl mb-2">🎉</div>
            <div className="text-2xl font-black">レベルアップ！</div>
            <div className="text-4xl font-black text-[#ff9600] mt-1">Lv.{levelUpNotification.level}</div>
          </div>
        </div>
      )}

      {/* メッセージエリア（入力欄の高さ分だけ下に余白） */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8 px-2">
            <div className="w-24 h-24 rounded-3xl bg-[#fff9e6] border-3 border-[#ffd900] flex items-center justify-center text-5xl shadow-lg">
              {agent.character_image_url ? (
                <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain rounded-3xl" />
              ) : stageEmoji}
            </div>
            <div>
              <p className="font-black text-gray-800 text-xl">{agent.name}</p>
              <p className="text-gray-400 font-bold text-sm mt-1">あなただけのAIパートナー</p>
            </div>

            {/* アプリの流れを説明するカード */}
            <div className="w-full max-w-xs space-y-2 mt-2">
              {[
                { step: '1', icon: '💬', title: '話しかける', desc: '会話するとXPがもらえる' },
                { step: '2', icon: '🌱', title: '性格が育つ', desc: '話し方でキャラが変わる' },
                { step: '3', icon: '🎨', title: '見た目が進化', desc: 'Lv.3・5・7・9で変身' },
                { step: '4', icon: '📋', title: '掲示板に参加', desc: 'Lv.5で解放される' },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} className="flex items-center gap-3 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 text-left">
                  <div className="w-7 h-7 rounded-full bg-[#58cc02] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-black">{step}</span>
                  </div>
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800">{title}</p>
                    <p className="text-xs font-bold text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl px-6 py-3 w-full max-w-xs">
              <p className="text-[#58cc02] font-black text-sm text-center">↓ まず話しかけてみよう！</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${isAI(msg.role) ? 'justify-start' : 'justify-end'}`}>
              {/* AIアイコン（左側） */}
              {isAI(msg.role) && (
                <div className="w-9 h-9 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center flex-shrink-0 overflow-hidden mb-1">
                  {agent.character_image_url ? (
                    <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-lg">{stageEmoji}</span>
                  )}
                </div>
              )}

              <div className={`flex flex-col max-w-[75%] ${isAI(msg.role) ? 'items-start' : 'items-end'}`}>
                <div className={isAI(msg.role) ? 'bubble-ai px-4 py-3' : 'bubble-user px-4 py-3'}>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 font-bold mt-1 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-9 h-9 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {agent.character_image_url ? (
                <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" />
              ) : <span className="text-lg">{stageEmoji}</span>}
            </div>
            <div className="bubble-ai px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-100 pb-safe">
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${agent.name}に話しかける...`}
            rows={1}
            disabled={sending}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none resize-none text-sm font-semibold text-gray-800 placeholder-gray-400 transition-all"
            style={{ minHeight: '48px', maxHeight: '120px', fontSize: '16px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !sending ? '#58cc02' : '#e5e5e5',
              boxShadow: input.trim() && !sending ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
            }}
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
