'use client';

import { useEffect, useState } from 'react';

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

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    // 24時間以内なら時刻のみ
    if (hours < 24) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
    
    // それ以外は日付と時刻
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${month}/${day} ${time}`;
  };

  useEffect(() => {
    fetchMessages();
  }, [agent.id]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
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
    <>
      {/* レベルアップ通知 */}
      {levelUpNotification && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 md:px-8 py-4 md:py-6 rounded-2xl shadow-2xl animate-bounce">
          <div className="text-center">
            <div className="text-4xl md:text-5xl mb-2">🎉</div>
            <div className="text-xl md:text-2xl font-bold mb-1">レベルアップ！</div>
            <div className="text-base md:text-lg">レベル {levelUpNotification.level}</div>
          </div>
        </div>
      )}

      {/* チャットカード */}
      <div className="bg-white rounded-lg shadow-md">
        {/* ヘッダー */}
        <div className="p-3 md:p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <h2 className="font-semibold text-gray-800 text-sm md:text-base">{agent.name}との会話</h2>
        </div>

        {/* メッセージエリア（スクロール可能） - 下部に余白を追加 */}
        <div className="p-3 md:p-4 space-y-2 md:space-y-3 bg-gray-50 pb-32" style={{ minHeight: '400px' }}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 md:mt-20">
              <p className="text-3xl md:text-4xl mb-3">💬</p>
              <p className="text-sm md:text-base">話しかけてみよう</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
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
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                  {formatMessageTime(msg.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 入力エリア（固定・フッターの真上） */}
      <div className="fixed bottom-16 left-0 right-0 p-2 md:p-3 bg-white border-t shadow-lg z-40">
        <div className="max-w-7xl mx-auto flex gap-2 items-end">
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
    </>
  );
}
