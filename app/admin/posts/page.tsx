'use client';

import { useEffect, useState } from 'react';
import type { Post, SpaceState } from '@/types';
import { detectSpaceState } from '@/lib/ai-logic';
import AdminHeader from '@/components/admin/AdminHeader';
import { getUserColor, formatTime } from '@/lib/utils';

interface PostWithDetails extends Post {
  reply_count?: number;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [filter, setFilter] = useState<'all' | 'user' | 'ai'>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPosts: 0,
    userPosts: 0,
    aiPosts: 0,
    totalUsers: 0,
    aiDensity: 0,
    spaceState: 'SILENCE' as SpaceState,
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      const allPosts: Post[] = data.posts || [];

      const userPosts = allPosts.filter(p => p.author_type === 'user');
      const aiPosts = allPosts.filter(p => p.author_type === 'ai');
      const uniqueUsers = new Set(allPosts.map(p => p.author_id)).size;
      const aiDensity = allPosts.length > 0 ? aiPosts.length / allPosts.length : 0;
      const spaceState = detectSpaceState(allPosts);

      const postsWithDetails = allPosts.map(post => ({
        ...post,
        reply_count: allPosts.filter(p => p.thread_id === post.id).length,
      }));

      setPosts(postsWithDetails);
      setStats({
        totalPosts: allPosts.length,
        userPosts: userPosts.length,
        aiPosts: aiPosts.length,
        totalUsers: uniqueUsers,
        aiDensity,
        spaceState,
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('この投稿を削除しますか？')) return;

    try {
      const res = await fetch(`/api/posts?id=${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadData();
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('削除に失敗しました');
    }
  };

  const filteredPosts = posts.filter(post => {
    if (filter === 'all') return true;
    return post.author_type === filter;
  });

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
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
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
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">スレッド</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">返信先</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">返信数</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">投稿日時</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPosts.map((post) => {
                    const replyToPost = post.thread_id ? posts.find(p => p.id === post.thread_id) : null;
                    
                    // デバッグログ
                    if (post.thread_id && !replyToPost) {
                      console.log('返信先が見つからない:', {
                        postId: post.id,
                        threadId: post.thread_id,
                        content: post.content,
                        allPostIds: posts.map(p => p.id)
                      });
                    }
                    
                    return (
                      <tr key={post.id} className={`hover:bg-gray-50 ${post.thread_id ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          {post.author_type === 'ai' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
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
                          {post.thread_id ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              💬 返信
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              📝 投稿
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          {post.thread_id ? (
                            replyToPost ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                  style={{ backgroundColor: getUserColor(replyToPost.author_id) }}
                                >
                                  {replyToPost.author_id.slice(-2)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-600 truncate max-w-[150px]">{replyToPost.author_id}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-[150px]">{replyToPost.content}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded">ID: {post.thread_id.slice(0, 8)}...</span>
                                <p className="text-[10px] text-red-500 mt-1">※投稿が削除された可能性</p>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <span className="text-xs sm:text-sm text-gray-600">{post.reply_count || 0}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">{formatTime(post.created_at)}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          {post.author_type === 'ai' && (
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors font-medium"
                            >
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredPosts.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">投稿がありません</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
