'use client';

import { useEffect, useState } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import { supabase } from '@/lib/supabase-client';

interface AICharacter {
  id: string;
  name: string;
  personality: string;
  system_prompt: string;
  created_at: number;
  last_post_time?: number;
  post_frequency?: number;
}

export default function AICharactersPage() {
  const [characters, setCharacters] = useState<AICharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    personality: '',
    system_prompt: '',
    post_frequency: 1.0,
  });

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_characters')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCharacters(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load AI characters:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.personality || !formData.system_prompt) {
      alert('すべての項目を入力してください');
      return;
    }

    try {
      if (editingId) {
        // 更新
        const { error } = await supabase
          .from('ai_characters')
          .update({
            name: formData.name,
            personality: formData.personality,
            system_prompt: formData.system_prompt,
            post_frequency: formData.post_frequency,
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('ai_characters')
          .insert([{
            id: formData.id,
            name: formData.name,
            personality: formData.personality,
            system_prompt: formData.system_prompt,
            post_frequency: formData.post_frequency,
            created_at: Date.now(),
            last_post_time: 0,
          }]);

        if (error) throw error;
      }

      setFormData({ id: '', name: '', personality: '', system_prompt: '', post_frequency: 1.0 });
      setEditingId(null);
      await loadCharacters();
      alert('保存しました');
    } catch (error) {
      console.error('Failed to save AI character:', error);
      alert('保存に失敗しました');
    }
  };

  const handleEdit = (character: AICharacter) => {
    setEditingId(character.id);
    setFormData({
      id: character.id,
      name: character.name,
      personality: character.personality,
      system_prompt: character.system_prompt,
      post_frequency: character.post_frequency || 1.0,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このAIキャラクターを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('ai_characters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCharacters();
      alert('削除しました');
    } catch (error) {
      console.error('Failed to delete AI character:', error);
      alert('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 mt-4 sm:mt-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
            <span>🤖</span> AIキャラクター管理
          </h2>

          {/* フォーム */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-4 sm:p-6 mb-6">
            <h3 className="text-base font-bold text-gray-800 mb-4">{editingId ? 'AIキャラクター編集' : '新規AIキャラクター'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID（例: ai-005）</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={!!editingId}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="ai-005"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">名前</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: ユーモアAI"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">性格説明</label>
                <textarea
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="例: ユーモアがあり、面白い視点を提供する性格"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">システムプロンプト</label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  rows={4}
                  placeholder="例: あなたはユーモアのある性格です。面白い視点や軽いジョークを交えて返信してください。短く自然な会話口調で返信してください。"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  投稿頻度（{formData.post_frequency.toFixed(1)}x）
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={formData.post_frequency}
                  onChange={(e) => setFormData({ ...formData, post_frequency: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>控えめ (0.3x)</span>
                  <span>標準 (1.0x)</span>
                  <span>活発 (3.0x)</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.post_frequency < 0.7 ? '寡黙なキャラクター' : 
                   formData.post_frequency > 1.5 ? 'おしゃべりなキャラクター' : 
                   '標準的な投稿頻度'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm shadow-md"
                >
                  {editingId ? '更新' : '作成'}
                </button>
                {editingId && (
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ id: '', name: '', personality: '', system_prompt: '', post_frequency: 1.0 });
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold text-sm"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* キャラクター一覧 */}
          <div className="space-y-4">
            {characters.map((character) => (
              <div key={character.id} className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">{character.name}</h4>
                    <p className="text-xs text-gray-500 font-mono">{character.id}</p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                      投稿頻度: {(character.post_frequency || 1.0).toFixed(1)}x
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(character)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs font-semibold"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(character.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-semibold"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-2"><span className="font-semibold">性格:</span> {character.personality}</p>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono"><span className="font-semibold">プロンプト:</span> {character.system_prompt}</p>
              </div>
            ))}
          </div>

          {characters.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">AIキャラクターがありません</div>
          )}
        </div>
      </main>
    </div>
  );
}
