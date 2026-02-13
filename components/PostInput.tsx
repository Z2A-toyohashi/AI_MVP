'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface PostInputProps {
  onPost: (content: string, mediaUrl?: string, type?: 'text' | 'voice' | 'image') => void;
  placeholder?: string;
  replyTo?: string;
  onCancel?: () => void;
}

export default function PostInput({
  onPost,
  placeholder = 'いま、思ったこと',
  replyTo,
  onCancel,
}: PostInputProps) {
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return;

    let mediaUrl: string | undefined;
    let type: 'text' | 'voice' | 'image' = 'text';

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
        type = 'image';
      } catch (error) {
        console.error('Upload failed:', error);
        alert('画像のアップロードに失敗しました');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onPost(content, mediaUrl, type);
    setContent('');
    setImagePreview(null);
    setImageFile(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ファイルサイズチェック（5MB以下）
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
        setContent((prev) => prev + data.text);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert(`音声の文字起こしに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  return (
    <div className="p-5 bg-gray-50/50 border-b-4 border-gray-100">
      {replyTo && (
        <div className="mb-3 flex items-center justify-between text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200">
          <span className="font-medium">💬 返信中...</span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-blue-400 hover:text-blue-600 transition-colors font-bold"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {imagePreview && (
        <div className="mb-4 relative inline-block">
          <img
            src={imagePreview}
            alt="プレビュー"
            className="max-h-64 rounded-xl border-2 border-blue-200 shadow-md"
          />
          <button
            onClick={() => {
              setImagePreview(null);
              setImageFile(null);
            }}
            className="absolute top-2 right-2 bg-black bg-opacity-70 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-90 transition-all shadow-lg"
          >
            ✕
          </button>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full resize-none border-0 focus:outline-none text-gray-900 text-[15px] placeholder-gray-400 mb-4 bg-transparent"
        rows={3}
      />

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md ${
              isRecording
                ? 'bg-indigo-600 text-white shadow-lg scale-110 ring-4 ring-indigo-200'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:shadow-lg'
            }`}
            title="長押しで録音"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 flex items-center justify-center transition-all shadow-md hover:shadow-lg"
            title="画像を選択"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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

        <button
          onClick={handleSubmit}
          disabled={(!content.trim() && !imageFile) || isUploading}
          className="px-10 py-3 bg-blue-600 text-white rounded-full hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all text-base font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-md"
        >
          {isUploading ? '送信中...' : '投稿'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Cmd/Ctrl + Enter で投稿
      </p>
    </div>
  );
}
