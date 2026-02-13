'use client';

import type { SpaceState } from '@/types';

interface MetricsPanelProps {
  stats: {
    totalPosts: number;
    userPosts: number;
    aiPosts: number;
    totalUsers: number;
    aiDensity: number;
    spaceState: SpaceState;
  };
}

export default function MetricsPanel({ stats }: MetricsPanelProps) {
  const getDensityColor = (density: number) => {
    if (density < 0.05) return 'from-gray-400 to-gray-500';
    if (density < 0.15) return 'from-green-400 to-green-500';
    return 'from-red-400 to-red-500';
  };

  const getDensityLabel = (density: number) => {
    if (density < 0.05) return '影響なし';
    if (density < 0.15) return 'ゴールデンゾーン';
    return 'AI感発生';
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'FLOW': return 'from-blue-400 to-blue-500';
      case 'SILENCE': return 'from-gray-400 to-gray-500';
      case 'FRAGILE': return 'from-yellow-400 to-yellow-500';
      case 'SOLO': return 'from-purple-400 to-purple-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getStateDescription = (state: string) => {
    switch (state) {
      case 'FLOW': return '会話継続中、投稿頻度高';
      case 'SILENCE': return '投稿間隔が長い（5分以上）';
      case 'FRAGILE': return '感情的投稿、返信減少';
      case 'SOLO': return '返信なし投稿';
      default: return '';
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        <span>📊</span> 空間メトリクス
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 p-5 sm:p-6 shadow-md">
          <h3 className="text-xs sm:text-sm font-bold text-gray-700 mb-3 sm:mb-4">AI密度</h3>
          <div className="text-center">
            <div className={`text-4xl sm:text-5xl font-bold bg-gradient-to-r ${getDensityColor(stats.aiDensity)} bg-clip-text text-transparent mb-2`}>
              {(stats.aiDensity * 100).toFixed(1)}%
            </div>
            <div className="text-xs sm:text-sm text-gray-600 font-medium">{getDensityLabel(stats.aiDensity)}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-300 p-5 sm:p-6 shadow-md">
          <h3 className="text-xs sm:text-sm font-bold text-gray-700 mb-3 sm:mb-4">空間状態</h3>
          <div className="text-center">
            <div className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r ${getStateColor(stats.spaceState)} bg-clip-text text-transparent mb-2`}>
              {stats.spaceState}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 font-medium">{getStateDescription(stats.spaceState)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-300 p-3 sm:p-4 text-center shadow-sm">
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalPosts}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">総投稿数</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 p-3 sm:p-4 text-center shadow-sm">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.userPosts}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">ユーザー投稿</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border-2 border-indigo-300 p-3 sm:p-4 text-center shadow-sm">
          <div className="text-xl sm:text-2xl font-bold text-indigo-600">{stats.aiPosts}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">AI投稿</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 p-3 sm:p-4 text-center shadow-sm">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalUsers}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">参加者数</div>
        </div>
      </div>
    </div>
  );
}
