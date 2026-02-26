'use client';

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  personality: {
    positive: number;
    talkative: number;
    curious: number;
    creative?: number;
    logical?: number;
    emotional?: number;
    adventurous?: number;
    cautious?: number;
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
  const [showPersonality, setShowPersonality] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(agent.name);
  const [savingName, setSavingName] = useState(false);

  const handlePostToBbs = async () => {
    if (posting || !agent.can_post_to_sns) return;

    setPosting(true);
    try {
      const res = await fetch('/api/agent-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });

      if (res.ok) {
        alert('掲示板に投稿しました！');
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || '投稿に失敗しました');
      }
    } catch (error) {
      console.error('Failed to post to board:', error);
      alert('投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      alert('名前を入力してください');
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, name: newName.trim() }),
      });

      if (res.ok) {
        alert('名前を変更しました！');
        setEditingName(false);
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || '名前の変更に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save name:', error);
      alert('名前の変更に失敗しました');
    } finally {
      setSavingName(false);
    }
  };

  const getAppearance = () => {
    const stages = ['🥚', '🐣', '🐥', '🐤', '🦜'];
    return stages[Math.min(appearance_stage - 1, stages.length - 1)];
  };

  const getExpProgress = () => {
    const expNeeded = level * 30;
    return (experience / expNeeded) * 100;
  };

  // レーダーチャート用のデータ
  const getRadarChartPoints = () => {
    const dimensions = [
      { label: 'ポジティブ', value: personality.positive || 0 },
      { label: 'おしゃべり', value: personality.talkative || 0 },
      { label: '好奇心', value: personality.curious || 0 },
      { label: '創造性', value: personality.creative || 0 },
      { label: '論理性', value: personality.logical || 0 },
      { label: '感情的', value: personality.emotional || 0 },
      { label: '冒険心', value: personality.adventurous || 0 },
      { label: '慎重さ', value: personality.cautious || 0 },
    ];

    const centerX = 100;
    const centerY = 100;
    const maxRadius = 80;
    const angleStep = (2 * Math.PI) / dimensions.length;

    // 背景の円（グリッド）
    const gridCircles = [0.25, 0.5, 0.75, 1.0].map(ratio => {
      const r = maxRadius * ratio;
      return `M ${centerX + r},${centerY} A ${r},${r} 0 1,0 ${centerX - r},${centerY} A ${r},${r} 0 1,0 ${centerX + r},${centerY}`;
    });

    // 軸線
    const axisLines = dimensions.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);
      return `M ${centerX},${centerY} L ${x},${y}`;
    });

    // データポイント
    const dataPoints = dimensions.map((dim, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const normalized = (dim.value + 10) / 20; // -10~10 を 0~1 に正規化
      const r = maxRadius * normalized;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return { x, y };
    });

    const dataPath = dataPoints.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
    ).join(' ') + ' Z';

    // ラベル位置
    const labels = dimensions.map((dim, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const labelRadius = maxRadius + 20;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);
      return { label: dim.label, x, y, value: dim.value };
    });

    return { gridCircles, axisLines, dataPath, labels };
  };

  const radarData = getRadarChartPoints();

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="text-center mb-4 md:mb-6">
        {agent.character_image_url ? (
          <div className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-2 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
            <img 
              src={agent.character_image_url} 
              alt={agent.name}
              className="w-full h-full object-contain"
              style={{ imageRendering: 'crisp-edges' }}
            />
          </div>
        ) : (
          <div className="text-5xl md:text-6xl mb-2">{getAppearance()}</div>
        )}
        
        {editingName ? (
          <div className="flex flex-col items-center gap-2 mt-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="新しい名前"
              maxLength={20}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setNewName(agent.name);
                }}
                disabled={savingName}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">{agent.name}</h2>
              {level >= 4 && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs text-purple-600 hover:text-purple-700"
                  title="名前を変更"
                >
                  ✏️
                </button>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500">レベル {level}</p>
            {level >= 4 && level < 5 && (
              <p className="text-xs text-purple-600 mt-1">✨ 名前変更可能</p>
            )}
            {agent.can_post_to_sns && (
              <p className="text-xs text-green-600 mt-1">✨ 掲示板投稿可能</p>
            )}
          </>
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
        <p className={`text-xs mt-1 text-center font-medium ${level >= 5 ? 'text-green-600' : 'text-purple-600'}`}>
          {level >= 5 
            ? '✨ レベル5到達！掲示板に交流しに行けます'
            : '✨ レベル5以上で掲示板に交流しに行けます'
          }
        </p>

        {/* レベル別解放機能 */}
        <div className="mt-3 p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <h4 className="text-xs font-bold text-gray-700 mb-2">🎯 成長で解放される機能</h4>
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2 text-xs ${level >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
              <span className="text-base">{level >= 1 ? '✅' : '🔒'}</span>
              <span className={level >= 1 ? 'font-medium' : ''}>レベル1: 誕生！会話できる</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${level >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
              <span className="text-base">{level >= 2 ? '✅' : '🔒'}</span>
              <span className={level >= 2 ? 'font-medium' : ''}>レベル2: 会話から学習し始める</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${level >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <span className="text-base">{level >= 3 ? '✅' : '🔒'}</span>
              <span className={level >= 3 ? 'font-medium' : ''}>レベル3: 日記を書き始める</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${level >= 4 ? 'text-green-600' : 'text-gray-400'}`}>
              <span className="text-base">{level >= 4 ? '✅' : '🔒'}</span>
              <span className={level >= 4 ? 'font-medium' : ''}>レベル4: 名前を自由に変更できる</span>
            </div>
            <div className={`flex items-center gap-2 text-xs ${level >= 5 ? 'text-green-600' : 'text-gray-400'}`}>
              <span className="text-base">{level >= 5 ? '✅' : '🔒'}</span>
              <span className={level >= 5 ? 'font-medium' : ''}>レベル5: 掲示板で交流できる</span>
            </div>
          </div>
        </div>
      </div>

      {/* レーダーチャート（折りたたみ可能） */}
      <div className="mb-4 md:mb-6">
        <button
          onClick={() => setShowPersonality(!showPersonality)}
          className="w-full flex items-center justify-between text-xs md:text-sm font-semibold text-gray-700 mb-2 hover:text-purple-600 transition-colors"
        >
          <span>性格</span>
          <span className="text-lg">{showPersonality ? '▼' : '▶'}</span>
        </button>
        
        {showPersonality && (
          <div className="mt-3">
            <svg viewBox="0 0 200 200" className="w-full max-w-xs mx-auto">
              {/* グリッド */}
              {radarData.gridCircles.map((path, i) => (
                <path
                  key={`grid-${i}`}
                  d={path}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              
              {/* 軸線 */}
              {radarData.axisLines.map((path, i) => (
                <path
                  key={`axis-${i}`}
                  d={path}
                  stroke="#d1d5db"
                  strokeWidth="1"
                />
              ))}
              
              {/* データ */}
              <path
                d={radarData.dataPath}
                fill="rgba(147, 51, 234, 0.2)"
                stroke="rgb(147, 51, 234)"
                strokeWidth="2"
              />
              
              {/* ラベル */}
              {radarData.labels.map((label, i) => (
                <text
                  key={`label-${i}`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[8px] fill-gray-600 font-medium"
                >
                  {label.label}
                </text>
              ))}
            </svg>
          </div>
        )}
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
            onClick={handlePostToBbs}
            disabled={posting}
            className="w-full py-2 md:py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-md text-sm md:text-base"
          >
            {posting ? '投稿中...' : '🌐 掲示板に投稿'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            レベル5到達で解放されました！
          </p>
        </div>
      )}
    </div>
  );
}
