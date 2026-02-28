'use client';

import { useEffect, useRef, useState } from 'react';
import { getUserId } from '@/lib/user';
import { getUserColor } from '@/lib/utils';
import Header from '@/components/Header';
import FooterNav from '@/components/FooterNav';

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const color = getUserColor(userId);

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    fetch(`/api/users?userId=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.display_name) { setDisplayName(d.display_name); setNameInput(d.display_name); }
        if (d.avatar_url) setAvatarUrl(d.avatar_url);
      })
      .catch(() => {});
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName: nameInput }),
      });
      if (res.ok) {
        setDisplayName(nameInput.trim());
        setEditing(false);
        flashSaved();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('5MB以下の画像を選択してください'); return; }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Supabase upload → fallback local
      let res = await fetch('/api/upload-supabase', { method: 'POST', body: formData });
      if (!res.ok) res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');

      const { url } = await res.json();

      // users テーブルに保存
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, avatarUrl: url }),
      });

      setAvatarUrl(url);
      flashSaved();
    } catch (e) {
      console.error(e);
      alert('アップロードに失敗しました');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="設定" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* プロフィール */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">プロフィール</p>

          {/* アイコン */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center text-white font-black text-xl flex-shrink-0 border-2 border-gray-100"
                style={{ backgroundColor: avatarUrl ? 'transparent' : color }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="アイコン" className="w-full h-full object-cover" />
                  : (displayName || userId).slice(-2).toUpperCase()
                }
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#58cc02] rounded-full flex items-center justify-center shadow-md border-2 border-white"
                style={{ boxShadow: '0 2px 0 #46a302' }}
              >
                {uploadingAvatar
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                }
              </button>
            </div>
            <p className="text-xs font-bold text-gray-400 mt-3">タップして画像を変更</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
          </div>

          {/* 名前 */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2">掲示板での名前</p>
            {editing ? (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
                  placeholder="名前を入力（20文字以内）"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none text-sm font-bold text-gray-800"
                  style={{ fontSize: '16px' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={!nameInput.trim() || saving}
                    className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                    style={{
                      background: nameInput.trim() && !saving ? '#58cc02' : '#e5e5e5',
                      boxShadow: nameInput.trim() && !saving ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
                      color: nameInput.trim() && !saving ? '#fff' : '#afafaf',
                    }}
                  >
                    {saving ? '保存中...' : '保存する'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setNameInput(displayName); }}
                    className="px-5 py-3 rounded-2xl font-black text-sm text-gray-500 bg-gray-100"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-base truncate">
                    {displayName || <span className="text-gray-400 font-bold text-sm">未設定</span>}
                  </p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">ID: {userId}</p>
                </div>
                <button
                  onClick={() => { setNameInput(displayName); setEditing(true); }}
                  className="flex-shrink-0 px-4 py-2 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-[#58cc02] hover:text-[#58cc02] transition-colors"
                >
                  編集
                </button>
              </div>
            )}
          </div>

          {saved && (
            <div className="mt-3 bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl px-4 py-2 text-center">
              <p className="text-[#58cc02] font-black text-sm">保存しました！</p>
            </div>
          )}
        </div>

        {/* プライバシー */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">プライバシー</p>
          <div className="space-y-2">
            {['個人情報は一切収集しません', 'ランダムなIDのみで参加できます', '投稿データは安全に保存されます'].map(text => (
              <div key={text} className="flex items-center gap-2">
                <span className="text-[#58cc02] font-black">✓</span>
                <span className="text-sm font-bold text-gray-600">{text}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
      <FooterNav />
    </div>
  );
}
