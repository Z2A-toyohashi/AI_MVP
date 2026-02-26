'use client';

import { useEffect, useState } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';

interface Agent {
  id: string;
  user_id: string;
  name: string;
  personality: any;
  level: number;
  character_image_url?: string;
  can_post_to_sns: boolean;
}

export default function AgentsAdminPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [editingGlobalPrompt, setEditingGlobalPrompt] = useState(false);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const getLevelFeatures = (level: number) => {
    const features = [
      { level: 1, feature: '✨ 誕生！主人と会話できる', unlocked: level >= 1 },
      { level: 2, feature: '📝 会話から学習し始める', unlocked: level >= 2 },
      { level: 3, feature: '📔 日記を書き始める', unlocked: level >= 3 },
      { level: 4, feature: '✏️ 名前を自由に変更できる', unlocked: level >= 4 },
      { level: 5, feature: '🌐 掲示板で他の人と交流できる', unlocked: level >= 5 },
    ];
    return features;
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${month}/${day} ${time}`;
  };

  const loadConversations = async (agentId: string) => {
    setLoadingConversations(true);
    try {
      const res = await fetch(`/api/conversations?agentId=${agentId}`);
      const data = await res.json();
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleAgentClick = async (agent: Agent) => {
    setSelectedAgent(agent);
    await loadConversations(agent.id);
  };

  useEffect(() => {
    loadAgents();
    loadGlobalPrompt();
  }, []);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalPrompt = async () => {
    try {
      const res = await fetch('/api/admin/system-prompt');
      const data = await res.json();
      setGlobalPrompt(data.system_prompt || '');
    } catch (error) {
      console.error('Failed to load global prompt:', error);
    }
  };

  const handleEditGlobalPrompt = () => {
    setEditingPromptText(globalPrompt);
    setEditingGlobalPrompt(true);
  };

  const handleSaveGlobalPrompt = async () => {
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/admin/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: editingPromptText }),
      });

      if (res.ok) {
        alert('グローバルシステムプロンプトを更新しました');
        setGlobalPrompt(editingPromptText);
        setEditingGlobalPrompt(false);
      } else {
        alert('更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('更新に失敗しました');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleEditName = (agent: Agent) => {
    setEditingName(agent.id);
    setNewName(agent.name);
  };

  const handleSaveName = async (agentId: string) => {
    if (!newName.trim()) {
      alert('名前を入力してください');
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, name: newName.trim() }),
      });

      if (res.ok) {
        alert('名前を更新しました');
        setEditingName(null);
        loadAgents();
      } else {
        const data = await res.json();
        alert(data.error || '更新に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save name:', error);
      alert('更新に失敗しました');
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">エージェント管理</h1>

        {/* グローバルシステムプロンプト */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">グローバルシステムプロンプト</h2>
              <p className="text-sm text-gray-500">全てのAIキャラに適用されるシステムプロンプト</p>
            </div>
            <button
              onClick={handleEditGlobalPrompt}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              編集
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {globalPrompt || '設定されていません'}
            </p>
          </div>
        </div>

        {/* エージェント一覧 */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">エージェント一覧</h2>
        <div className="grid gap-6">
          {agents.map((agent) => (
            <div 
              key={agent.id} 
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleAgentClick(agent)}
            >
              <div className="flex items-start gap-4">
                {agent.character_image_url && (
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    <img 
                      src={agent.character_image_url} 
                      alt={agent.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {editingName === agent.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="新しい名前"
                          maxLength={20}
                        />
                        <button
                          onClick={() => handleSaveName(agent.id)}
                          disabled={savingName}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingName(null)}
                          disabled={savingName}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-gray-800">{agent.name}</h3>
                        {agent.level >= 4 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditName(agent);
                            }}
                            className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded hover:bg-purple-200 transition-colors"
                          >
                            ✏️ 名前変更
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-2">
                    ユーザーID: {agent.user_id} | レベル: {agent.level}
                    {agent.level < 4 && (
                      <span className="ml-2 text-xs text-orange-600">
                        （レベル4で名前変更可能）
                      </span>
                    )}
                  </p>

                  <div className="flex gap-2 text-xs flex-wrap">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      ポジ: {agent.personality.positive || 0}
                    </span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      話: {agent.personality.talkative || 0}
                    </span>
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      好奇心: {agent.personality.curious || 0}
                    </span>
                    {agent.can_post_to_sns && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        掲示板投稿可
                      </span>
                    )}
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      👁️ クリックで詳細
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* グローバルプロンプト編集モーダル */}
      {editingGlobalPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                グローバルシステムプロンプト編集
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                全てのAIキャラに適用されます
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                value={editingPromptText}
                onChange={(e) => setEditingPromptText(e.target.value)}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="システムプロンプトを入力..."
              />

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">💡 プロンプトのヒント</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 全AIキャラの基本的な性格や口調を定義</li>
                  <li>• 返答の長さや形式を指定（例：「1〜2文で短く」）</li>
                  <li>• 禁止事項を明記（例：「絵文字は使わない」）</li>
                  <li>• ユーザーとの関係性を定義（例：「主人の第二の自分」）</li>
                  <li>• 各キャラの性格パラメータは自動的に追加されます</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setEditingGlobalPrompt(false)}
                disabled={savingPrompt}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveGlobalPrompt}
                disabled={savingPrompt}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {savingPrompt ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* エージェント詳細モーダル */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedAgent.character_image_url && (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                    <img 
                      src={selectedAgent.character_image_url} 
                      alt={selectedAgent.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedAgent.name}</h2>
                  <p className="text-sm text-gray-500">レベル {selectedAgent.level} | {selectedAgent.user_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* レベル別機能 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🎯 解放された機能</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getLevelFeatures(selectedAgent.level).map((feature, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        feature.unlocked
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{feature.unlocked ? '✅' : '🔒'}</span>
                        <div>
                          <p className={`text-sm font-medium ${
                            feature.unlocked ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            レベル{feature.level}
                          </p>
                          <p className={`text-xs ${
                            feature.unlocked ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {feature.feature}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 会話ログ */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 会話ログ（最新50件）</h3>
                {loadingConversations ? (
                  <div className="text-center py-8 text-gray-500">読み込み中...</div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">💬</p>
                    <p>まだ会話がありません</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`flex ${conv.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[80%]">
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              conv.role === 'user'
                                ? 'bg-purple-500 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{conv.content}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 px-1">
                            {formatMessageTime(conv.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
