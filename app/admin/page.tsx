'use client';

import { useEffect, useState } from 'react';
import type { Post, SpaceState } from '@/types';
import { detectSpaceState } from '@/lib/ai-logic';
import AISettings from '@/components/admin/AISettings';
import MetricsPanel from '@/components/admin/MetricsPanel';
import PostsLog from '@/components/admin/PostsLog';

interface PostWithDetails extends Post {
  reply_count?: number;
}

export default function AdminPage() {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <header className="bg-white border-b-2 border-purple-200 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            🎛️ 管理画面
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">投稿ログ・メトリクス・AI設定</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 mt-4 sm:mt-6 mb-8">
        <AISettings currentAIDensity={stats.aiDensity} />
        <MetricsPanel stats={stats} />
        <PostsLog 
          posts={posts}
          filter={filter}
          setFilter={setFilter}
          stats={stats}
        />
      </main>
    </div>
  );
}
