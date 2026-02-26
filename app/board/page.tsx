'use client';

import { useEffect, useState } from 'react';
import type { Post } from '@/types';
import { getUserId } from '@/lib/user';
import { supabase } from '@/lib/supabase-client';
import { randomDelay } from '@/lib/utils';
import PostItem from '@/components/PostItem';
import PostInput from '@/components/PostInput';

export default function BoardPage() {
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
    const clickedPost = posts.find(p => p.id === threadId);
    
    if (clickedPost) {
      const rootThreadId = clickedPost.thread_id || clickedPost.id;
      const rootPost = clickedPost.thread_id 
        ? posts.find(p => p.id === clickedPost.thread_id)
        : clickedPost;
      
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

        const aiUserId = data.ai_id;

        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: aiUserId }),
        });

        const aiPost: Post = {
          id: `ai-${Date.now()}-${Math.random()}`,
          content: data.content,
          type: data.media_url ? 'image' : 'text',
          created_at: Date.now(),
          thread_id: data.thread_id || null,
          author_type: 'ai',
          author_id: aiUserId,
          media_url: data.media_url || null,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-16">
      <div className="w-full max-w-2xl mx-auto bg-white min-h-screen shadow-lg flex flex-col">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm flex-shrink-0 sticky top-0 z-10">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-gray-800 text-center">掲示板</h1>
          </div>
        </header>

        <main className="flex-1">
          <div className="border-b-4 border-gray-200 shadow-sm bg-white">
            <PostInput
              onPost={handlePost}
              replyTo={replyTo}
              replyToPost={replyToPost}
              onCancel={handleCancelReply}
              placeholder={replyTo ? '返信を入力...' : 'いま、思ったこと'}
            />
          </div>

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
                  onReactionUpdate={fetchPosts}
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

      {/* フッターナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
          <a href="/" className="flex flex-col items-center justify-center flex-1 text-gray-600 hover:text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs">チャット</span>
          </a>
          <a href="/board" className="flex flex-col items-center justify-center flex-1 text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <span className="text-xs">掲示板</span>
          </a>
          <a href="/events" className="flex flex-col items-center justify-center flex-1 text-gray-600 hover:text-purple-600 transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">帰還ログ</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
