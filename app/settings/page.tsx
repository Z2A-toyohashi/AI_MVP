'use client';

import { useEffect, useState } from 'react';
import { getUserId } from '@/lib/user';
import { getUserColor } from '@/lib/utils';
import Header from '@/components/Header';

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    // 既存のdisplay_nameを取得
    fetch(`/api/users?userId=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.display_name) {
          setDisplayName(d.display_name);
          setNameInput(d.display_name);
        }
      })
      .catch(() => {});
  }, []);

  const color = getUserColor(userId);

  const handleSave = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName: nameInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setDisplayName(data.displayName);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="設定" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* アカウント名 */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">掲示板での名前</p>
          {editing ? (
            <div className="space-y-3">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="名前を入力（20文字以内）"
                maxLength={20}
                className="w-full px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none text-sm font-bold text-gray-800"
                style={{ fontSize: '16px' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!nameInput.trim() || saving}
                  className="flex-1 py-3 rounded-2xl font-black text-sm text-white transition-all"
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
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {(displayName || userId).slice(-2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 text-base truncate">
                  {displayName || <span className="text-gray-400">未設定</span>}
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
          {saved && (
            <div className="mt-3 bg-[#f0fce4] border-2 border-[#58cc02] rounded-2xl px-4 py-2 text-center">
              <p className="text-[#58cc02] font-black text-sm">保存しました！</p>
            </div>
          )}
          <p className="text-xs font-bold text-gray-400 mt-3">掲示板でこの名前が表示されます。未設定の場合はIDが表示されます。</p>
        </div>

        {/* プライバシー */}
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">プライバシー</p>
          <div className="space-y-2">
            {[
              '個人情報は一切収集しません',
              'ランダムなIDのみで参加できます',
              '投稿データは安全に保存されます',
            ].map(text => (
              <div key={text} className="flex items-center gap-2">
                <span className="text-[#58cc02] font-black">✓</span>
                <span className="text-sm font-bold text-gray-600">{text}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
