'use client';

import { useEffect, useState, useRef } from 'react';

interface Agent {
  id: string;
  name: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

interface Props {
  agent: Agent;
}

export default function AgentChat({ agent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [levelUpNotification, setLevelUpNotification] = useState<{level: number, stage: number} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [agent.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    const userMessage = input.trim();
    setInput('');

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          content: userMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchMessages();
        
        // レベルアップ通知
        if (data.levelUp) {
          setLevelUpNotification({ level: data.newLevel, stage: data.newStage });
          setTimeout(() => setLevelUpNotification(null), 4000);
          
          // レベル5到達で掲示板解放通知
          if (data.canPostToSns && data.newLevel === 5) {
            setTimeout(() => {
              alert('🎉 おめでとう！レベル5到達で掲示板に投稿できるようになりました！');
            }, 4000);
          }
          
          // 親コンポーネントに通知（リロード）
          setTimeout(() => {
            window.location.reload();
          }, 4500);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col h-full relative overflow-hidden">
      {/* レベルアップ通知 */}
      {levelUpNotification && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 md:px-8 py-4 md:py-6 rounded-2xl shadow-2xl animate-bounce">
          <div className="text-center">
            <div className="text-4xl md:text-5xl mb-2">🎉</div>
            <div className="text-xl md:text-2xl font-bold mb-1">レベルアップ！</div>
            <div className="text-base md:text-lg">レベル {levelUpNotification.level}</div>
          </div>
        </div>
      )}

      {/* ヘッダー（固定） */}
      <div className="p-3 md:p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
        <h2 className="font-semibold text-gray-800 text-sm md:text-base">{agent.name}との会話</h2>
      </div>

      {/* メッセージエリア（スクロール可能） - flex-1で残りの高さを全て使用 */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 md:mt-20">
            <p className="text-3xl md:text-4xl mb-3">💬</p>
            <p className="text-sm md:text-base">話しかけてみよう</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3 md:px-4 py-2 md:py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                }`}
              >
                <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア（固定） */}
      <div className="p-2 md:p-3 border-t bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージ"
            rows={1}
            className="flex-1 px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none overflow-hidden min-h-[40px] md:min-h-[44px] max-h-[80px] md:max-h-[100px] text-sm md:text-base"
            style={{
              height: 'auto',
              minHeight: '40px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              const maxHeight = window.innerWidth < 768 ? 80 : 100;
              target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px';
            }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center bg-purple-500 text-white rounded-full hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title={sending ? '送信中...' : '送信'}
          >
            {sending ? (
              <svg className="animate-spin h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
