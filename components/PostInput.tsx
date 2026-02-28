'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import type { Post } from '@/types';
import { getUserColor } from '@/lib/utils';

interface PostInputProps {
  onPost: (content: string, mediaUrl?: string, type?: 'text' | 'voice' | 'image') => void;
  placeholder?: string;
  replyTo?: string;
  replyToPost?: Post;
  onCancel?: () => void;
}

export default function PostInput({
  onPost,
  placeholder = 'いま、思ったこと',
  replyTo,
  replyToPost,
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
    console.log('=== Submit Debug ===');
    console.log('Content:', content);
    console.log('Image file:', imageFile);
    console.log('==================');

    if (!content.trim() && !imageFile) return;

    let mediaUrl: string | undefined;
    let type: 'text' | 'voice' | 'image' = 'text';

    if (imageFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', imageFile);

      console.log('=== Upload Start ===');
      console.log('File name:', imageFile.name);
      console.log('File size:', imageFile.size);
      console.log('File type:', imageFile.type);

      try {
        // Try Supabase upload first (for production)
        console.log('Attempting Supabase upload...');
        let res = await fetch('/api/upload-supabase', {
          method: 'POST',
          body: formData,
        });
        
        console.log('Supabase upload response status:', res.status);
        
        // If Supabase fails, fallback to local upload (for development)
        if (!res.ok) {
          console.log('Supabase upload failed, trying local upload...');
          res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          console.log('Local upload response status:', res.status);
        }
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error('Upload error response:', errorData);
          throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await res.json();
        console.log('Upload success:', data);
        mediaUrl = data.url;
        type = 'image';
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`画像のアップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onPost(content, mediaUrl, type);
    setContent('');
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    console.log('=== Image Select Debug ===');
    console.log('File selected:', file);
    console.log('File name:', file?.name);
    console.log('File size:', file?.size);
    console.log('File type:', file?.type);
    console.log('========================');
    
    if (file) {
      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        alert('画像サイズは5MB以下にしてください');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // ファイルタイプチェック
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        alert('画像の読み込みに失敗しました');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
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
    <div className="p-4 bg-white">
      {replyTo && replyToPost && (
        <div className="mb-3 bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-[#58cc02]">返信先</span>
            {onCancel && (
              <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 font-black text-lg leading-none">✕</button>
            )}
          </div>
          <p className="text-xs font-bold text-gray-600 line-clamp-2">{replyToPost.content}</p>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <img src={imagePreview} alt="プレビュー" className="max-h-48 rounded-2xl border-2 border-[#84d8ff]" />
          <button
            onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-black"
          >✕</button>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full resize-none border-0 focus:outline-none text-gray-800 placeholder-gray-400 font-semibold bg-transparent mb-3"
        style={{ fontSize: '16px' }}
        rows={3}
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all font-black ${
              isRecording
                ? 'bg-[#ff4b4b] text-white shadow-[0_4px_0_#cc0000]'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="長押しで録音"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-all"
            title="画像を選択"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,image/heic,image/heif" onChange={handleImageSelect} className="hidden" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={(!content.trim() && !imageFile) || isUploading}
          className="btn-duo px-8 py-3 text-sm"
          style={{
            background: (content.trim() || imageFile) && !isUploading ? '#58cc02' : '#e5e5e5',
            color: (content.trim() || imageFile) && !isUploading ? '#fff' : '#afafaf',
            boxShadow: (content.trim() || imageFile) && !isUploading ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
            borderRadius: '16px',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            cursor: (content.trim() || imageFile) && !isUploading ? 'pointer' : 'not-allowed',
          }}
        >
          {isUploading ? '送信中...' : '投稿'}
        </button>
      </div>
    </div>
  );
}
