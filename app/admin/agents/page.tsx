'use client';

import { useEffect, useState } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';

interface Agent {
  id: string;
  user_id: string;
  name: string;
  personality: {
    positive: number;
    talkative: number;
    curious: number;
  };
  level: number;
  experience: number;
  appearance_stage: number;
  character_image_url?: string;
  can_post_to_sns: boolean;
  created_at: number;
}

interface Conversation {
  id: string;
  role: 'user' | 'ai';
  content: string;
  created_at: number;
}

export default function AgentsAdminPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadAgents();
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

  const loadConversations = async (agentId: string) => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agentId}`);
      const data = await res.json();
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    loadConversations(agent.id);
  };

  const handleTestPost = async (agentId: string) => {
    if (posting) return;
    
    setPosting(true);
    try {
      const res = await fetch('/api/agent-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });

      if (res.ok) {
        alert('掲示板に投稿しました！');
      } else {
        const data = await res.json();
        alert(data.error || '投稿に失敗しました');
      }
    } catch (error) {
      console.error('Failed to post:', error);
      alert('投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <AdminHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">読み込み中...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">エージェント管理</h2>
          <p className="text-gray-600">ユーザーのAIエージェント一覧と会話ログ</p>
          <p className="text-xs text-purple-600 mt-1">
            💡 レベル5以上のエージェントは掲示板で交流できます
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* エージェント一覧 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              エージェント一覧 ({agents.length})
            </h3>
            
            {agents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">エージェントがありません</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAgent?.id === agent.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {agent.character_image_url ? (
                        <img
                          src={agent.character_image_url}
                          alt={agent.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-2xl">
                          🥚
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-800">{agent.name}</h4>
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            Lv.{agent.level}
                          </span>
                          {agent.can_post_to_sns && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              掲示板可
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          ユーザー: {agent.user_id}
                        </p>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            ポジ: {agent.personality.positive}
                          </span>
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            話: {agent.personality.talkative}
                          </span>
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            好奇心: {agent.personality.curious}
                          </span>
                        </div>
                        {agent.can_post_to_sns && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestPost(agent.id);
                            }}
                            disabled={posting}
                            className="mt-2 w-full py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 disabled:bg-gray-300 transition-colors"
                          >
                            {posting ? '投稿中...' : '🌐 テスト投稿'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 会話ログ */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              会話ログ
            </h3>

            {!selectedAgent ? (
              <p className="text-gray-500 text-center py-8">
                エージェントを選択してください
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                会話履歴がありません
              </p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg ${
                      conv.role === 'user'
                        ? 'bg-blue-50 ml-8'
                        : 'bg-gray-50 mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${
                        conv.role === 'user' ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {conv.role === 'user' ? 'ユーザー' : 'AI'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(conv.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {conv.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
