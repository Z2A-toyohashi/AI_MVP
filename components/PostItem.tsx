'use client';

import { useState, useEffect } from 'react';
import type { Post } from '@/types';
import { getUserColor, formatTime } from '@/lib/utils';

// ユーザーIDから一貫したアバター文字を生成
function AvatarCircle({ id, size = 10 }: { id: string; size?: number }) {
  const { avatarUrl } = useUserProfile(id, 'user');
  const color = getUserColor(id);
  const label = id.slice(-2).toUpperCase();

  if (avatarUrl) {
    return (
      <div className={`w-${size} h-${size} rounded-2xl overflow-hidden flex-shrink-0 border-2 border-gray-100`}>
        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-2xl flex items-center justify-center text-white font-black text-sm flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {label}
    </div>
  );
}

// ユーザープロフィール（名前 + アイコン）を取得するhook
function useUserProfile(userId: string, authorType: string): { displayName: string; avatarUrl: string | null } {
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (authorType === 'user') {
      fetch(`/api/users?userId=${userId}`)
        .then(r => r.json())
        .then(d => {
          if (d.display_name) setName(d.display_name);
          if (d.avatar_url) setAvatarUrl(d.avatar_url);
        })
        .catch(() => {});
    }
  }, [userId, authorType]);
  return { displayName: name || userId, avatarUrl };
}

// 後方互換用
function useDisplayName(userId: string, authorType: string): string {
  return useUserProfile(userId, authorType).displayName;
}

function AgentAvatar({ userId, size = 10 }: { userId: string; size?: number }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents?userId=${userId}`)
      .then(r => r.json())
      .then(a => {
        if (a.character_image_url) setImgUrl(a.character_image_url);
        if (a.name) setName(a.name);
      })
      .catch(() => {});
  }, [userId]);

  if (imgUrl) {
    return (
      <div className={`w-${size} h-${size} rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] overflow-hidden flex-shrink-0`}>
        <img src={imgUrl} alt={name || 'AI'} className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center text-lg flex-shrink-0`}>
      🐣
    </div>
  );
}

interface ReplyItemProps {
  reply: Post;
  onReply: (threadId: string) => void;
}

function ReplyItem({ reply, onReply }: ReplyItemProps) {
  const [agentName, setAgentName] = useState<string | null>(null);
  const userDisplayName = useDisplayName(reply.author_id, reply.author_type);

  useEffect(() => {
    if (reply.author_type === 'agent') {
      fetch(`/api/agents?userId=${reply.author_id}`)
        .then(r => r.json())
        .then(a => { if (a.name) setAgentName(a.name); })
        .catch(() => {});
    }
  }, [reply.author_id, reply.author_type]);

  const displayName = reply.author_type === 'agent' && agentName ? agentName : userDisplayName;

  return (
    <div className="flex gap-3 py-3">
      {reply.author_type === 'agent'
        ? <AgentAvatar userId={reply.author_id} size={8} />
        : <AvatarCircle id={reply.author_id} size={8} />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-black text-gray-800 text-sm">{displayName}</span>
          <span className="text-[11px] text-gray-400 font-bold">{formatTime(reply.created_at)}</span>
        </div>
        <p className="text-sm text-gray-700 font-semibold whitespace-pre-wrap break-words leading-relaxed">
          {reply.content}
        </p>
        <button
          onClick={() => onReply(reply.id)}
          className="mt-1 text-[11px] font-black text-gray-400 hover:text-[#58cc02] transition-colors"
        >
          返信
        </button>
      </div>
    </div>
  );
}

interface PostItemProps {
  post: Post;
  replies?: Post[]; // 後方互換のためoptional
  onReply: (threadId: string) => void;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
  onReactionUpdate?: () => void;
}

export default function PostItem({ post, replies: initialReplies, onReply, currentUserId, onDelete, onReactionUpdate }: PostItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Post[]>(initialReplies || []);
  const [replyCount, setReplyCount] = useState<number | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { count: number; users: Array<{ id: string; isAI: boolean }>; userReacted: boolean }>>({});
  const [agentName, setAgentName] = useState<string | null>(null);
  const userDisplayName = useDisplayName(post.author_id, post.author_type);

  const commonEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  useEffect(() => {
    loadReactions();
    if (post.author_type === 'agent') {
      fetch(`/api/agents?userId=${post.author_id}`)
        .then(r => r.json())
        .then(a => { if (a.name) setAgentName(a.name); })
        .catch(() => {});
    }
    // 返信数だけ軽量に取得
    fetch(`/api/posts?threadId=${post.id}`)
      .then(r => r.json())
      .then(d => { if (d.posts) setReplyCount(d.posts.length); })
      .catch(() => {});
  }, [post.id]);

  const handleToggleReplies = async () => {
    if (!showReplies && replies.length === 0) {
      setLoadingReplies(true);
      try {
        const res = await fetch(`/api/posts?threadId=${post.id}`);
        const data = await res.json();
        setReplies(data.posts || []);
        setReplyCount((data.posts || []).length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingReplies(false);
      }
    }
    setShowReplies(prev => !prev);
  };

  const loadReactions = async () => {
    try {
      const res = await fetch(`/api/reactions?postId=${post.id}`);
      const data = await res.json();
      if (data.reactions) {
        const checked: typeof reactions = {};
        Object.entries(data.reactions).forEach(([emoji, info]: [string, any]) => {
          checked[emoji] = {
            ...info,
            userReacted: currentUserId ? info.users.some((u: any) => u.id === currentUserId) : false,
          };
        });
        setReactions(checked);
      }
    } catch (e) { console.error(e); }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUserId) return;
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, userId: currentUserId, emoji }),
      });
      await loadReactions();
      onReactionUpdate?.();
    } catch (e) { console.error(e); }
    setShowReactionPicker(false);
  };

  const displayName = post.author_type === 'agent' && agentName ? agentName : userDisplayName;
  const isAI = post.author_type === 'agent';

  return (
    <article className="px-4 py-4 border-b border-gray-100">
      <div className="flex gap-3">
        {/* アバター */}
        {isAI
          ? <AgentAvatar userId={post.author_id} size={10} />
          : <AvatarCircle id={post.author_id} size={10} />
        }

        <div className="flex-1 min-w-0">
          {/* 名前 + 時刻 */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-black text-gray-800 text-sm">{displayName}</span>
            <span className="text-[11px] text-gray-400 font-bold ml-auto">{formatTime(post.created_at)}</span>
          </div>

          {/* 本文 */}
          <p className="text-[15px] text-gray-800 font-semibold whitespace-pre-wrap break-words leading-relaxed mb-3">
            {post.content}
          </p>

          {/* 画像 */}
          {post.media_url && (
            <div className="mb-3 rounded-2xl overflow-hidden border-2 border-gray-100 max-w-xs">
              <img src={post.media_url} alt="投稿画像" className="w-full h-auto max-h-56 object-contain bg-gray-50" />
            </div>
          )}

          {/* リアクション表示 */}
          {Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(reactions).map(([emoji, info]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-black transition-all ${
                    info.userReacted
                      ? 'bg-[#f0fce4] border-2 border-[#58cc02] text-[#58cc02]'
                      : 'bg-gray-100 border-2 border-gray-100 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{info.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onReply(post.id)}
              className="text-[12px] font-black text-gray-400 hover:text-[#1cb0f6] transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              返信
            </button>

            {(replyCount ?? replies.length) > 0 && (
              <button
                onClick={handleToggleReplies}
                className="text-[12px] font-black text-gray-400 hover:text-[#58cc02] transition-colors flex items-center gap-1"
              >
                {loadingReplies ? (
                  <span className="w-3 h-3 border border-[#58cc02] border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  showReplies ? '▲' : '▼'
                )}
                {replyCount ?? replies.length}件
              </button>
            )}

            {/* リアクション */}
            <div className="relative">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="text-[12px] font-black text-gray-400 hover:text-[#ff9600] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                リアクション
              </button>
              {showReactionPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowReactionPicker(false)} />
                  <div className="absolute left-0 top-full mt-2 bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-2 flex gap-1 z-20">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-1 rounded-xl hover:bg-gray-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 削除 */}
            {currentUserId && post.author_id === currentUserId && onDelete && (
              <button
                onClick={() => { if (confirm('削除しますか？')) onDelete(post.id); }}
                className="text-[12px] font-black text-gray-300 hover:text-[#ff4b4b] transition-colors ml-auto"
              >
                削除
              </button>
            )}
          </div>

          {/* 返信スレッド */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 pl-3 border-l-2 border-gray-100">
              {replies.sort((a, b) => a.created_at - b.created_at).map((reply) => (
                <ReplyItem key={reply.id} reply={reply} onReply={onReply} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
