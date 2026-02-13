'use client';

import { useEffect, useState, useRef } from 'react';
import { getUserId } from '@/lib/user';
import Header from '@/components/Header';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  media_url?: string;
  media_type?: 'image' | 'voice';
  created_at: number;
}

export default function ChatPage() {
  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    
    // ローカルストレージから会話履歴を読み込む
    const saved = localStorage.getItem('chat-history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }
  }, []);

  useEffect(() => {
    // 会話履歴を保存
    if (messages.length > 0) {
      localStorage.setItem('chat-history', JSON.stringify(messages));
    }
    // 自動スクロール
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessageToDatabase = async (message: Message) => {
    try {
      await fetch('/api/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          role: message.role,
          content: message.content,
          media_url: message.media_url || null,
          media_type: message.media_type || null,
          created_at: message.created_at,
        }),
      });
    } catch (error) {
      console.error('Failed to save message to database:', error);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageFile) || isLoading) return;

    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'voice' | undefined;
    let imageBase64: string | undefined;

    // 画像アップロード処理
    if (imageFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', imageFile);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          throw new Error('Upload failed');
        }
        
        const data = await res.json();
        mediaUrl = data.url;
        mediaType = 'image';

        // 画像をbase64に変換（OpenAI API用）
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      } catch (error) {
        console.error('Upload failed:', error);
        alert('画像のアップロードに失敗しました');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessageToDatabase(userMessage);
    
    setInput('');
    setImagePreview(null);
    setImageFile(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => {
            const msg: any = {
              role: m.role === 'user' ? 'user' : 'assistant',
            };
            
            // 最新メッセージで画像がある場合はbase64を使用
            if (m.id === userMessage.id && imageBase64) {
              msg.content = [
                { type: 'text', text: m.content || 'この画像について教えてください' },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: imageBase64
                  } 
                }
              ];
            } else if (m.media_url && m.media_type === 'image') {
              // 過去のメッセージは画像の説明のみ
              msg.content = m.content || '（画像を送信しました）';
            } else {
              msg.content = m.content;
            }
            
            return msg;
          }),
        }),
      });

      const data = await res.json();

      if (data.response) {
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: data.response,
          created_at: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        await saveMessageToDatabase(aiMessage);
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
      alert('AIの応答取得に失敗しました');
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('画像サイズは5MB以下にしてください');
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
      alert('マイクへのアクセスが拒否されました');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Transcription failed');
      }
      
      const data = await res.json();
      if (data.text) {
        setInput((prev) => prev + data.text);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert(`音声の文字起こしに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const clearHistory = () => {
    if (confirm('会話履歴をクリアしますか？')) {
      setMessages([]);
      localStorage.removeItem('chat-history');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl bg-white min-h-screen shadow-lg flex flex-col">
        <Header userId={userId} title="AIと1on1" />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* メッセージエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-6xl mb-4">🤖</div>
                  <p className="text-gray-400 text-sm">AIと1対1で会話できます</p>
                  <p className="text-gray-400 text-xs mt-2">何でも話しかけてみてください</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 border border-gray-200'
                      }`}
                    >
                      {message.media_url && message.media_type === 'image' && (
                        <img
                          src={message.media_url}
                          alt="送信画像"
                          className="max-w-full rounded-lg mb-2"
                        />
                      )}
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-2xl shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 入力エリア */}
          <div className="border-t-2 border-gray-200 p-4 bg-gray-50">
            {messages.length > 0 && (
              <div className="mb-3 flex justify-end">
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  🗑️ 履歴をクリア
                </button>
              </div>
            )}

            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="プレビュー"
                  className="max-h-32 rounded-lg border-2 border-purple-200 shadow-md"
                />
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  className="absolute top-1 right-1 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-opacity-90 transition-all text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力..."
                  className="w-full resize-none border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${
                      isRecording
                        ? 'bg-red-500 text-white shadow-lg scale-110 ring-4 ring-red-200'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                    title="長押しで録音"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 flex items-center justify-center transition-all shadow-sm"
                    title="画像を選択"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !imageFile) || isLoading || isUploading}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none h-fit"
              >
                {isUploading ? '送信中...' : '送信'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Cmd/Ctrl + Enter で送信</p>
          </div>
        </main>
      </div>
    </div>
  );
}

