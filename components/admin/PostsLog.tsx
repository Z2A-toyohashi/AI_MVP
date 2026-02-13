'use client';

import type { Post, SpaceState } from '@/types';
import { getUserColor, formatTime } from '@/lib/utils';

interface PostWithDetails extends Post {
  reply_count?: number;
}

interface PostsLogProps {
  posts: PostWithDetails[];
  filter: 'all' | 'user' | 'ai';
  setFilter: (filter: 'all' | 'user' | 'ai') => void;
  stats: {
    totalPosts: number;
    userPosts: number;
    aiPosts: number;
    totalUsers: number;
    aiDensity: number;
    spaceState: SpaceState;
  };
}

export default function PostsLog({ posts, filter, setFilter, stats }: PostsLogProps) {
  const filteredPosts = posts.filter(post => {
    if (filter === 'all') return true;
    return post.author_type === filter;
  });

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
        <span>📝</span> 投稿ログ
      </h2>
      
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm shadow-sm ${
              filter === 'all'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            すべて ({stats.totalPosts})
          </button>
          <button
            onClick={() => setFilter('user')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm shadow-sm ${
              filter === 'user'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
            }`}
          >
            👤 ユーザー ({stats.userPosts})
          </button>
          <button
            onClick={() => setFilter('ai')}
            className={`px-4 py-2 rounded-lg font-medium transition-all text-sm shadow-sm ${
              filter === 'ai'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-purple-50 border border-gray-200'
            }`}
          >
            🤖 AI ({stats.aiPosts})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">タイプ</th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">投稿者ID</th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">内容</th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">返信数</th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">投稿日時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    {post.author_type === 'ai' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        🤖 AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        👤 ユーザー
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: getUserColor(post.author_id) }}
                      >
                        {post.author_id.slice(-2)}
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{post.author_id}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    <p className="text-xs sm:text-sm text-gray-900 line-clamp-2 max-w-md">{post.content}</p>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    <span className="text-xs sm:text-sm text-gray-600">{post.reply_count || 0}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3">
                    <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">{formatTime(post.created_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">投稿がありません</div>
        )}
      </div>
    </div>
  );
}
