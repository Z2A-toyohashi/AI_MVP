'use client';

import { useEffect, useState } from 'react';
import type { Post } from '@/types';
import { getUserId } from '@/lib/user';
import { supabase } from '@/lib/supabase-client';
import { randomDelay } from '@/lib/utils';
import PostItem from '@/components/PostItem';
import PostInput from '@/components/PostInput';
import Header from '@/components/Header';

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [replyToPost, setReplyToPost] = useState<Post | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
    
    const subscription = supabase
      .channel('posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(checkAIIntervention, 30000);
    return () => clearInterval(interval);
  }, [posts]);

  const initializeApp = async () => {
    const id = getUserId();
    setUserId(id);

    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });

    await fetchPosts();
    setLoading(false);
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const handlePost = async (content: string, mediaUrl?: string, type: 'text' | 'voice' | 'image' = 'text') => {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const post: Post = {
      id: `${Date.now()}-${Math.random()}`,
      content,
      type,
      created_at: Date.now(),
      thread_id: replyTo || null,
      author_type: 'user',
      author_id: userId,
      media_url: mediaUrl || null,
    };

    console.log('=== Posting ===');
    console.log('Reply to:', replyTo);
    console.log('Reply to post:', replyToPost);
    console.log('Post object:', post);
    console.log('===============');

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });

      await fetchPosts();
      setReplyTo(undefined);
      setReplyToPost(undefined);
    } catch (error) {
      console.error('Failed to post:', error);
    }
  };

  const handleReply = (threadId: string) => {
    // threadIdが返信の場合は、その返信が属するスレッドのルート投稿を探す
    const clickedPost = posts.find(p => p.id === threadId);
    
    console.log('=== Reply Debug ===');
    console.log('Clicked post ID:', threadId);
    console.log('Clicked post:', clickedPost);
    
    if (clickedPost) {
      // クリックされた投稿が返信の場合は、そのthread_idを使用
      // そうでなければ、クリックされた投稿自体がルート投稿
      const rootThreadId = clickedPost.thread_id || clickedPost.id;
      const rootPost = clickedPost.thread_id 
        ? posts.find(p => p.id === clickedPost.thread_id)
        : clickedPost;
      
      console.log('Root thread ID:', rootThreadId);
      console.log('Root post:', rootPost);
      console.log('==================');
      
      setReplyTo(rootThreadId);
      setReplyToPost(rootPost);
    }
  };

  const handleCancelReply = () => {
    setReplyTo(undefined);
    setReplyToPost(undefined);
  };

  const checkAIIntervention = async () => {
    if (posts.length === 0) return;

    try {
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts }),
      });

      const data = await res.json();

      if (data.shouldPost) {
        await randomDelay(5, 20);

        const aiUserId = Math.floor(1000 + Math.random() * 9000).toString();

        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: aiUserId }),
        });

        const aiPost: Post = {
          id: `ai-${Date.now()}-${Math.random()}`,
          content: data.content,
          type: 'text',
          created_at: Date.now(),
          thread_id: data.thread_id || null,
          author_type: 'ai',
          author_id: aiUserId,
          media_url: null,
        };

        await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiPost),
        });

        await fetchPosts();
      }
    } catch (error) {
      console.error('AI check failed:', error);
    }
  };

  const getReplies = (threadId: string): Post[] => {
    return posts.filter((p) => p.thread_id === threadId);
  };

  const topLevelPosts = posts.filter((p) => !p.thread_id);
  
  // AI介入率を計算
  const aiPosts = posts.filter(p => p.author_type === 'ai');
  const aiDensity = posts.length > 0 ? (aiPosts.length / posts.length) * 100 : 0;
  
  console.log('=== Posts Debug ===');
  console.log('Total posts:', posts.length);
  console.log('Top level posts:', topLevelPosts.length);
  console.log('Posts with thread_id:', posts.filter(p => p.thread_id).length);
  console.log('All posts:', posts.map(p => ({ id: p.id, thread_id: p.thread_id, content: p.content.slice(0, 20) })));
  console.log('==================');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl bg-white min-h-screen shadow-lg">
        <Header userId={userId} title="空間" />

        {/* AI介入率表示 */}
        {posts.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-200 px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">🤖 AI介入率:</span>
                <span className="font-bold text-indigo-700">{aiDensity.toFixed(1)}%</span>
                <span className="text-gray-400">({aiPosts.length}/{posts.length})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(aiDensity, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <main className="pb-8">
          {/* 投稿入力 */}
          <div className="border-b-4 border-gray-200 shadow-sm bg-white">
            <PostInput
              onPost={handlePost}
              replyTo={replyTo}
              replyToPost={replyToPost}
              onCancel={handleCancelReply}
              placeholder={replyTo ? '返信を入力...' : 'いま、思ったこと'}
            />
          </div>

          {/* タイムライン */}
          <div className="bg-white">
            {topLevelPosts.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-gray-300 mb-3">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-400">まだ投稿がありません</p>
              </div>
            ) : (
              topLevelPosts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  replies={getReplies(post.id)}
                  onReply={handleReply}
                  currentUserId={userId}
                  onDelete={async (postId) => {
                    try {
                      await fetch(`/api/posts?id=${postId}`, {
                        method: 'DELETE',
                      });
                      await fetchPosts();
                    } catch (error) {
                      console.error('Failed to delete post:', error);
                    }
                  }}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
