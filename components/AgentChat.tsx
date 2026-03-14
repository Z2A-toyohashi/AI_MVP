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
  const [levelUpNotification, setLevelUpNotification] = useState<{ level: number; evolved: boolean } | null>(null);
  const [testPosting, setTestPosting] = useState(false);
  const [testPostResult, setTestPostResult] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; uploadedUrl?: string; type: 'image' | 'voice' } | null>(null);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // マウント時にグリーティングを試みる（APIが今日済みなら自動スキップ）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (sending) return;
      setSending(true);
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, content: '__ai_greeting__', isGreeting: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.skipped) await fetchMessages();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSending(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [agent.id]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      if (!res.ok) {
        console.error('fetchMessages failed:', res.status);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        // 既読にする
        fetch(`/api/conversations?agentId=${agent.id}&markRead=true`, { method: 'PATCH' }).catch(() => {});
      }
    } catch (e) {
      console.error('fetchMessages error:', e);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !mediaPreview) || sending) return;
    setSending(true);
    const msg = input.trim();
    const media = mediaPreview;
    setInput('');
    setMediaPreview(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 楽観的にユーザーメッセージを表示
    const tempId = `temp-${Date.now()}`;
    const displayContent = media?.type === 'image'
      ? (msg ? `${msg}\n[IMAGE:${media.url}]` : `[IMAGE:${media.url}]`)
      : media?.type === 'voice'
      ? (msg ? `${msg}\n[音声を送信]` : '[音声を送信]')
      : msg;

    setMessages(prev => [...prev, {
      id: tempId, role: 'user',
      content: displayContent,
      created_at: Date.now(),
    } as any]);

    try {
      const body: any = { agentId: agent.id, content: msg || '（画像を送りました）' };
      if (media?.type === 'image') {
        // StorageにアップロードされたURLがあればそれを使う、なければBase64をフォールバック
        body.imageUrl = media.uploadedUrl || null;
        body.imageBase64 = media.uploadedUrl ? undefined : media.url;
      } else if (media?.type === 'voice') {
        body.content = msg ? `${msg}（音声メッセージ付き）` : '（音声メッセージを送りました）';
      }

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Send success:', data);
        // fetchMessagesが失敗しても楽観的表示は消えない（上のfetchMessages修正で対応済み）
        await fetchMessages();
        if (data.levelUp) {
          const evolved = [3, 5, 7, 9].includes(data.newLevel);
          setLevelUpNotification({ level: data.newLevel, evolved });
          setTimeout(() => setLevelUpNotification(null), evolved ? 4000 : 3000);
          setTimeout(() => { onLevelUp?.(); }, evolved ? 4200 : 3200);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Send failed:', res.status, errData);
        // 失敗時は楽観的表示を消して入力を戻す
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInput(msg);
        if (res.status === 404) {
          alert('データの不整合が検出されました。ページを再読み込みします。');
          window.location.reload();
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Canvas で最大 800px にリサイズ → Blob → Supabase Storage にアップロード
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      // プレビュー用Base64（表示のみ）
      const previewBase64 = canvas.toDataURL('image/jpeg', 0.7);
      // まずプレビューを表示（アップロード中も見える）
      setMediaPreview({ url: previewBase64, type: 'image' });
      URL.revokeObjectURL(objectUrl);
      // Storageにアップロードしてpublic URLを取得
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const formData = new FormData();
          formData.append('image', blob, 'chat-image.jpg');
          const res = await fetch('/api/upload-supabase', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            // uploadedUrl にStorageのURLを保存
            setMediaPreview(prev => prev ? { ...prev, uploadedUrl: data.url } : prev);
          }
        }, 'image/jpeg', 0.7);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  const handleVoiceToggle = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setMediaPreview({ url, type: 'voice' });
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error('マイクへのアクセスが拒否されました', e);
    }
  };

  const isAI = (role: string) => role === 'assistant' || role === 'ai';

  // [IMAGE:url] を検出してテキストと画像に分割して表示
  const renderContent = (content: string) => {
    const parts = content.split(/(\[IMAGE:[^\]]+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[IMAGE:(.+)\]$/);
      if (match) {
        return (
          <img
            key={i}
            src={match[1]}
            alt="送信した画像"
            className="max-w-full rounded-xl mt-1 max-h-48 object-contain"
          />
        );
      }
      return part ? <span key={i} className="whitespace-pre-wrap break-words">{part}</span> : null;
    });
  };

  const handleTestPost = async () => {
    setTestPosting(true);
    setTestPostResult(null);
    try {
      const res = await fetch('/api/batch/agent-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();
      if (data.success) {
        setTestPostResult(`投稿完了: ${data.content}`);
      } else {
        setTestPostResult(`失敗: ${data.error || 'unknown error'}`);
      }
    } catch (e) {
      setTestPostResult('エラーが発生しました');
    } finally {
      setTestPosting(false);
      setTimeout(() => setTestPostResult(null), 5000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* レベルアップ通知 */}
      {levelUpNotification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          {levelUpNotification.evolved ? (
            <div className="animate-levelup text-center px-10 py-8">
              <div className="text-7xl mb-3 animate-bounce">✨</div>
              <div className="bg-[#ffd900] text-gray-800 px-10 py-6 rounded-3xl shadow-2xl border-4 border-[#ffb800]">
                <div className="text-2xl font-black mb-1">進化した！</div>
                <div className="text-5xl font-black text-[#ff9600]">理解度 {levelUpNotification.level}</div>
                <div className="text-sm font-bold text-gray-600 mt-2">見た目が変わったよ！</div>
              </div>
              <div className="text-7xl mt-3 animate-bounce" style={{ animationDelay: '150ms' }}>✨</div>
            </div>
          ) : (
            <div className="animate-levelup bg-[#ffd900] text-gray-800 px-10 py-8 rounded-3xl shadow-2xl text-center border-4 border-[#ffb800]">
              <div className="text-5xl mb-2">🎉</div>
              <div className="text-2xl font-black">理解が深まった！</div>
              <div className="text-4xl font-black text-[#ff9600] mt-1">理解度 {levelUpNotification.level}</div>
            </div>
          )}
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
                  <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                    {renderContent(msg.content)}
                  </div>
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
        {/* テスト用: 掲示板投稿ボタン */}
        <div className="max-w-lg mx-auto mb-2">
          {testPostResult && (
            <div className="text-xs font-bold text-gray-500 bg-gray-100 rounded-xl px-3 py-2 mb-2 break-words">
              {testPostResult}
            </div>
          )}
          <button
            onClick={handleTestPost}
            disabled={testPosting}
            className="w-full py-2 rounded-xl text-xs font-black border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#58cc02] hover:text-[#58cc02] transition-all"
          >
            {testPosting ? '投稿中...' : '🧪 テスト: 掲示板に投稿する'}
          </button>
        </div>
        <div className="max-w-lg mx-auto">
          {/* メディアプレビュー */}
          {mediaPreview && (
            <div className="mb-2 flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2">
              {mediaPreview.type === 'image' ? (
                <img src={mediaPreview.url} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎤</span>
                  <audio src={mediaPreview.url} controls className="h-8 max-w-[160px]" />
                </div>
              )}
              <button onClick={() => setMediaPreview(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            {/* 画像ボタン */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {/* 音声ボタン */}
            <button
              onClick={handleVoiceToggle}
              disabled={sending}
              className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-colors flex-shrink-0 ${recording ? 'bg-red-100 animate-pulse' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <svg className={`w-5 h-5 ${recording ? 'text-red-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
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
              disabled={(!input.trim() && !mediaPreview) || sending}
              className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0 transition-all"
              style={{
                background: (input.trim() || mediaPreview) && !sending ? '#58cc02' : '#e5e5e5',
                boxShadow: (input.trim() || mediaPreview) && !sending ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
              }}
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
