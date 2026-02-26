'use client';

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  personality: {
    positive: number;
    talkative: number;
    curious: number;
  };
  level: number;
  experience: number;
  appearance_stage: number;
  is_outside: boolean;
  character_image_url?: string;
  can_post_to_sns?: boolean;
}

interface Props {
  agent: Agent;
  onUpdate: () => void;
}

export default function AgentStatus({ agent, onUpdate }: Props) {
  const { personality, level, experience, appearance_stage } = agent;
  const [posting, setPosting] = useState(false);

  const handlePostToSns = async () => {
    if (posting || !agent.can_post_to_sns) return;

    setPosting(true);
    try {
      const res = await fetch('/api/agent-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });

      if (res.ok) {
        alert('SNSに投稿しました！');
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || '投稿に失敗しました');
      }
    } catch (error) {
      console.error('Failed to post to SNS:', error);
      alert('投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const getAppearance = () => {
    const stages = ['🥚', '🐣', '🐥', '🐤', '🦜'];
    return stages[Math.min(appearance_stage - 1, stages.length - 1)];
  };

  const getExpProgress = () => {
    const expNeeded = level * 30; // プロトタイプ用に簡単
    return (experience / expNeeded) * 100;
  };

  const getPersonalityBar = (value: number, label: string) => {
    const normalized = ((value + 10) / 20) * 100;
    return (
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{label}</span>
          <span>{value > 0 ? '+' : ''}{value}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${normalized}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="text-center mb-4 md:mb-6">
        {agent.character_image_url ? (
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-2 relative">
            <img 
              src={agent.character_image_url} 
              alt={agent.name}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="text-5xl md:text-6xl mb-2">{getAppearance()}</div>
        )}
        <h2 className="text-lg md:text-xl font-bold text-gray-800">{agent.name}</h2>
        <p className="text-xs md:text-sm text-gray-500">レベル {level}</p>
        {agent.can_post_to_sns && (
          <p className="text-xs text-green-600 mt-1">✨ SNS投稿可能</p>
        )}
      </div>

      {/* 経験値バー */}
      <div className="mb-4 md:mb-6">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>経験値</span>
          <span>{experience} / {level * 30}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 md:h-3 rounded-full transition-all"
            style={{ width: `${getExpProgress()}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">
          会話するほど成長します
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3">性格</h3>
        {getPersonalityBar(personality.positive, 'ポジティブ')}
        {getPersonalityBar(personality.talkative, 'おしゃべり')}
        {getPersonalityBar(personality.curious, '好奇心')}
      </div>

      {agent.is_outside && (
        <div className="mt-4 md:mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 text-center">
            🚶 外出中...
          </p>
        </div>
      )}

      {agent.can_post_to_sns && (
        <div className="mt-4 md:mt-6">
          <button
            onClick={handlePostToSns}
            disabled={posting}
            className="w-full py-2 md:py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-md text-sm md:text-base"
          >
            {posting ? '投稿中...' : '🌐 SNS「空間」に投稿'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            レベル5到達で解放されました！
          </p>
        </div>
      )}
    </div>
  );
}
