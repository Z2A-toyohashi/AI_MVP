'use client';

import { useEffect, useState } from 'react';
import type { Post } from '@/types';
import { getUserId } from '@/lib/user';
import { supabase } from '@/lib/supabase-client';
import { randomDelay } from '@/lib/utils';
import PostItem from '@/components/PostItem';
import PostInput from '@/components/PostInput';
import FooterNav from '@/components/FooterNav';

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
    const interval = setInterval(checkCharacterIntervention, 30000);
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

  const checkCharacterIntervention = async () => {
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

        const characterUserId = data.ai_id;

        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: characterUserId }),
        });

        const characterPost: Post = {
          id: `ai-${Date.now()}-${Math.random()}`,
          content: data.content,
          type: data.media_url ? 'image' : 'text',
          created_at: Date.now(),
          thread_id: data.thread_id || null,
          author_type: 'ai',
          author_id: characterUserId,
          media_url: data.media_url || null,
        };

        await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(characterPost),
        });

        await fetchPosts();
      }
    } catch (error) {
      console.error('Character check failed:', error);
    }
  };

  const getReplies = (threadId: string): Post[] => {
    return posts.filter((p) => p.thread_id === threadId);
  };

  const topLevelPosts = posts.filter((p) => !p.thread_id);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="text-5xl animate-bounce">📋</div>
        <p className="text-gray-400 font-black text-sm tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-16">
      <div className="w-full max-w-lg mx-auto flex flex-col min-h-screen">
        {/* ヘッダー */}
        <header className="bg-white border-b-2 border-gray-100 flex-shrink-0 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-center">
            <h1 className="text-lg font-black text-gray-800">掲示板</h1>
          </div>
        </header>

        <main className="flex-1">
          <div className="border-b-2 border-gray-100 bg-white">
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
              <div className="py-20 text-center px-8">
                <div className="text-6xl mb-4">📝</div>
                <p className="font-black text-gray-700 text-lg mb-2">まだ投稿がありません</p>
                <p className="text-gray-400 font-bold text-sm">最初の投稿をしてみよう！</p>
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
                      await fetch(`/api/posts?id=${postId}`, { method: 'DELETE' });
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

      <FooterNav />
    </div>
  );
}
