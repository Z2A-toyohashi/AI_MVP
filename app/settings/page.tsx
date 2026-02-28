'use client';

import { useEffect, useRef, useState } from 'react';
import { getUserId } from '@/lib/user';
import { getUserColor } from '@/lib/utils';
import Header from '@/components/Header';
import FooterNav from '@/components/FooterNav';

type AvatarMode = 'upload' | 'generate';

export default function SettingsPage() {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // アイコン関連
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('upload');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);

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

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const saveAvatarUrl = async (url: string) => {
    setSavingAvatar(true);
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, avatarUrl: url }),
      });
      setAvatarUrl(url);
      setPreviewUrl('');
      flashSaved();
    } catch (e) { console.error(e); }
    finally { setSavingAvatar(false); }
  };

  // アップロード
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('5MB以下の画像を選択してください'); return; }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      let res = await fetch('/api/upload-supabase', { method: 'POST', body: formData });
      if (!res.ok) res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      await saveAvatarUrl(url);
    } catch (e) { console.error(e); alert('アップロードに失敗しました'); }
    finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  // AI生成
  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setPreviewUrl('');
    try {
      const res = await fetch('/api/generate-user-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, userId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const { url } = await res.json();
      setPreviewUrl(url);
    } catch (e) { console.error(e); alert('生成に失敗しました'); }
    finally { setGenerating(false); }
  };

  // 名前保存
  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName: nameInput }),
      });
      setDisplayName(nameInput.trim());
      setEditingName(false);
      flashSaved();
    } catch (e) { console.error(e); }
    finally { setSavingName(false); }
  };

  const currentAvatar = previewUrl || avatarUrl;

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="設定" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* プロフィール */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">プロフィール</p>

          {/* 現在のアイコン */}
          <div className="flex justify-center mb-4">
            <div
              className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center text-white font-black text-xl border-2 border-gray-100"
              style={{ backgroundColor: currentAvatar ? 'transparent' : color }}
            >
              {currentAvatar
                ? <img src={currentAvatar} alt="アイコン" className="w-full h-full object-cover" />
                : (displayName || userId).slice(-2).toUpperCase()
              }
            </div>
          </div>

          {/* モード切替タブ */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
            {(['upload', 'generate'] as AvatarMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setAvatarMode(mode); setPreviewUrl(''); }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  avatarMode === mode
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400'
                }`}
              >
                {mode === 'upload' ? '📁 画像をアップロード' : '✨ AIで生成'}
              </button>
            ))}
          </div>

          {/* アップロードモード */}
          {avatarMode === 'upload' && (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-black text-gray-500 hover:border-[#58cc02] hover:text-[#58cc02] transition-colors flex items-center justify-center gap-2"
              >
                {uploadingAvatar ? (
                  <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />アップロード中...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>画像を選択</>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
              <p className="text-xs font-bold text-gray-400 mt-2 text-center">5MB以下のJPG・PNG・GIF</p>
            </div>
          )}

          {/* AI生成モード */}
          {avatarMode === 'generate' && (
            <div className="space-y-3">
              <textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="例: a cute fox with blue eyes, a robot with a friendly smile, a magical cat..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none text-sm font-semibold text-gray-800 placeholder-gray-400 resize-none"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={handleGenerate}
                disabled={!genPrompt.trim() || generating}
                className="w-full py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: genPrompt.trim() && !generating ? '#58cc02' : '#e5e5e5',
                  boxShadow: genPrompt.trim() && !generating ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
                  color: genPrompt.trim() && !generating ? '#fff' : '#afafaf',
                }}
              >
                {generating ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />生成中（約10秒）...</>
                ) : '✨ アイコンを生成する'}
              </button>

              {/* プレビュー */}
              {previewUrl && (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-[#58cc02]">
                      <img src={previewUrl} alt="プレビュー" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveAvatarUrl(previewUrl)}
                      disabled={savingAvatar}
                      className="flex-1 py-3 rounded-2xl font-black text-sm text-white transition-all"
                      style={{ background: '#58cc02', boxShadow: '0 4px 0 #46a302' }}
                    >
                      {savingAvatar ? '保存中...' : 'これに決める'}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="px-4 py-3 rounded-2xl font-black text-sm text-gray-500 bg-gray-100 border-2 border-gray-200"
                    >
                      再生成
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 名前 */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">掲示板での名前</p>
          {editingName ? (
            <div className="space-y-3">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                placeholder="名前を入力（20文字以内）"
                maxLength={20}
                className="w-full px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none text-sm font-bold text-gray-800"
                style={{ fontSize: '16px' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveName}
                  disabled={!nameInput.trim() || savingName}
                  className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                  style={{
                    background: nameInput.trim() && !savingName ? '#58cc02' : '#e5e5e5',
                    boxShadow: nameInput.trim() && !savingName ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
                    color: nameInput.trim() && !savingName ? '#fff' : '#afafaf',
                  }}
                >
                  {savingName ? '保存中...' : '保存する'}
                </button>
                <button onClick={() => { setEditingName(false); setNameInput(displayName); }} className="px-5 py-3 rounded-2xl font-black text-sm text-gray-500 bg-gray-100">
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
                onClick={() => { setNameInput(displayName); setEditingName(true); }}
                className="flex-shrink-0 px-4 py-2 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-[#58cc02] hover:text-[#58cc02] transition-colors"
              >
                編集
              </button>
            </div>
          )}
        </div>

        {saved && (
          <div className="bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl px-4 py-3 text-center">
            <p className="text-[#58cc02] font-black text-sm">保存しました！</p>
          </div>
        )}

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
