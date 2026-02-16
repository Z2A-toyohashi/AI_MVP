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
  can_generate_images?: boolean;
  image_generation_probability?: number;
  image_prompts?: string[];
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
    can_generate_images: false,
    image_generation_probability: 0.05,
    image_prompts: [] as string[],
  });
  const [newPrompt, setNewPrompt] = useState('');

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
            can_generate_images: formData.can_generate_images,
            image_generation_probability: formData.image_generation_probability,
            image_prompts: formData.image_prompts,
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
            can_generate_images: formData.can_generate_images,
            image_generation_probability: formData.image_generation_probability,
            image_prompts: formData.image_prompts,
            created_at: Date.now(),
            last_post_time: 0,
          }]);

        if (error) throw error;
      }

      setFormData({ 
        id: '', 
        name: '', 
        personality: '', 
        system_prompt: '', 
        post_frequency: 1.0,
        can_generate_images: false,
        image_generation_probability: 0.05,
        image_prompts: [],
      });
      setNewPrompt('');
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
      can_generate_images: character.can_generate_images || false,
      image_generation_probability: character.image_generation_probability || 0.05,
      image_prompts: character.image_prompts || [],
    });
    setNewPrompt('');
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

  const handleTestImageGeneration = async (character: AICharacter) => {
    if (!character.can_generate_images) {
      alert('このAIは画像生成が無効です。まず有効化してください。');
      return;
    }

    if (!character.image_prompts || character.image_prompts.length === 0) {
      alert('画像プロンプトが設定されていません。');
      return;
    }

    if (!confirm(`${character.name}で画像生成をテストしますか？\n\nコスト: $0.04`)) {
      return;
    }

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiCharacterId: character.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Image generation failed');
      }

      const data = await response.json();
      
      alert(`✅ 画像生成成功！\n\nコメント: ${data.comment}\nシーン: ${data.scene}\n\n画像URLをコンソールに出力しました。`);
      console.log('Generated Image URL:', data.imageUrl);
      console.log('Comment:', data.comment);
      console.log('Scene:', data.scene);
      
      // 画像を新しいタブで開く
      window.open(data.imageUrl, '_blank');
    } catch (error) {
      console.error('Image generation test failed:', error);
      alert(`❌ 画像生成に失敗しました\n\n${error instanceof Error ? error.message : '不明なエラー'}`);
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

              <div className="border-t-2 border-gray-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="can_generate_images"
                    checked={formData.can_generate_images}
                    onChange={(e) => setFormData({ ...formData, can_generate_images: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="can_generate_images" className="text-sm font-semibold text-gray-700">
                    🎨 画像生成機能を有効化
                  </label>
                </div>
                
                {formData.can_generate_images && (
                  <div className="ml-8 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        画像生成確率（{(formData.image_generation_probability * 100).toFixed(0)}%）
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.20"
                        step="0.01"
                        value={formData.image_generation_probability}
                        onChange={(e) => setFormData({ ...formData, image_generation_probability: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>稀に (1%)</span>
                        <span>時々 (10%)</span>
                        <span>頻繁に (20%)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        画像プロンプト（このAIの性格に合った日常風景）
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={newPrompt}
                          onChange={(e) => setNewPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newPrompt.trim()) {
                              setFormData({ 
                                ...formData, 
                                image_prompts: [...formData.image_prompts, newPrompt.trim()] 
                              });
                              setNewPrompt('');
                            }
                          }}
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="例: A cheerful coffee cup with smiley face latte art"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newPrompt.trim()) {
                              setFormData({ 
                                ...formData, 
                                image_prompts: [...formData.image_prompts, newPrompt.trim()] 
                              });
                              setNewPrompt('');
                            }
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-semibold"
                        >
                          追加
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        英語でプロンプトを入力してください。このAIの性格に合った日常風景を記述します。
                      </p>
                      
                      {formData.image_prompts.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {formData.image_prompts.map((prompt, index) => (
                            <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                              <span className="flex-1 text-xs font-mono text-gray-700">{prompt}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    image_prompts: formData.image_prompts.filter((_, i) => i !== index)
                                  });
                                }}
                                className="text-red-500 hover:text-red-700 text-sm font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {formData.image_prompts.length === 0 && (
                        <p className="text-xs text-gray-400 italic">プロンプトが登録されていません</p>
                      )}
                    </div>

                    <p className="text-xs text-gray-500">
                      💡 コスト: DALL-E 3は1枚あたり$0.04です
                    </p>
                  </div>
                )}
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
                      setFormData({ 
                        id: '', 
                        name: '', 
                        personality: '', 
                        system_prompt: '', 
                        post_frequency: 1.0,
                        can_generate_images: false,
                        image_generation_probability: 0.05,
                        image_prompts: [],
                      });
                      setNewPrompt('');
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
                    <div className="flex gap-3 mt-1">
                      <p className="text-xs text-blue-600 font-semibold">
                        投稿頻度: {(character.post_frequency || 1.0).toFixed(1)}x
                      </p>
                      {character.can_generate_images && (
                        <p className="text-xs text-purple-600 font-semibold">
                          🎨 画像: {((character.image_generation_probability || 0.05) * 100).toFixed(0)}% ({character.image_prompts?.length || 0}種類)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {character.can_generate_images && character.image_prompts && character.image_prompts.length > 0 && (
                      <button
                        onClick={() => handleTestImageGeneration(character)}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-semibold"
                        title="画像生成をテスト"
                      >
                        🎨 テスト
                      </button>
                    )}
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
