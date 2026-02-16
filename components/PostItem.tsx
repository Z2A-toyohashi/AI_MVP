'use client';

import { useState, useEffect } from 'react';
import type { Post } from '@/types';
import { getUserColor, formatTime } from '@/lib/utils';

interface PostItemProps {
  post: Post;
  replies: Post[];
  onReply: (threadId: string) => void;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
  onReactionUpdate?: () => void;
}

export default function PostItem({ post, replies, onReply, currentUserId, onDelete, onReactionUpdate }: PostItemProps) {
  const [showReplies, setShowReplies] = useState(replies.length > 0); // 返信がある場合は自動展開
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { count: number; users: Array<{ id: string; isAI: boolean }>; userReacted: boolean }>>({});
  const color = getUserColor(post.author_id);

  const commonEmojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  useEffect(() => {
    loadReactions();
  }, [post.id]);

  const loadReactions = async () => {
    try {
      const res = await fetch(`/api/reactions?postId=${post.id}`);
      const data = await res.json();
      if (data.reactions) {
        // ユーザーがリアクションしたかチェック
        const reactionsWithUserCheck: typeof reactions = {};
        Object.entries(data.reactions).forEach(([emoji, info]: [string, any]) => {
          reactionsWithUserCheck[emoji] = {
            ...info,
            userReacted: currentUserId ? info.users.some((u: any) => u.id === currentUserId) : false,
          };
        });
        setReactions(reactionsWithUserCheck);
      }
    } catch (error) {
      console.error('Failed to load reactions:', error);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUserId) return;

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          userId: currentUserId,
          emoji,
        }),
      });

      if (res.ok) {
        await loadReactions();
        if (onReactionUpdate) onReactionUpdate();
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
    setShowReactionPicker(false);
  };

  return (
    <article className="border-b border-gray-200 px-4 py-6 hover:bg-gray-50/50 transition-colors">
      <div className="flex gap-3">
        {/* アバター */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-md ring-2 ring-white"
          style={{ backgroundColor: color }}
        >
          {post.author_id.slice(-2)}
        </div>

        <div className="flex-1 min-w-0">
          {/* ヘッダー */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900 text-sm">
              {post.author_id}
            </span>
            <span className="text-gray-400 text-sm">{formatTime(post.created_at)}</span>
          </div>

          {/* コンテンツ */}
          <p className="text-gray-900 whitespace-pre-wrap break-words mb-3 text-[15px] leading-relaxed">
            {post.content}
          </p>

          {/* 画像 */}
          {post.media_url && (
            <div className="mb-4 rounded-xl overflow-hidden border-2 border-gray-200 max-w-sm shadow-sm">
              <img
                src={post.media_url}
                alt="投稿画像"
                className="w-full h-auto max-h-64 object-contain bg-gray-50"
              />
            </div>
          )}

          {/* アクション */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-5 text-sm">
              <button
                onClick={() => onReply(post.id)}
                className="text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                返信
              </button>

              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-gray-500 hover:text-purple-600 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <svg className={`w-4 h-4 transition-transform ${showReplies ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {replies.length}件の返信
                </button>
              )}

              {/* リアクションボタン */}
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className="text-gray-500 hover:text-yellow-600 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  リアクション
                </button>

                {/* リアクションピッカー */}
                {showReactionPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowReactionPicker(false)}
                    />
                    <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-xl border-2 border-gray-200 p-2 flex gap-1 z-20">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-gray-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 削除ボタン（自分の投稿のみ） */}
            {currentUserId && post.author_id === currentUserId && onDelete && (
              <button
                onClick={() => {
                  if (confirm('この投稿を削除しますか？')) {
                    onDelete(post.id);
                  }
                }}
                className="text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                削除
              </button>
            )}
          </div>

          {/* リアクション表示 */}
          {Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(reactions).map(([emoji, info]) => (
                <div key={emoji} className="relative group">
                  <button
                    onClick={() => handleReaction(emoji)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all ${
                      info.userReacted
                        ? 'bg-blue-100 border-2 border-blue-400 text-blue-700'
                        : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="font-semibold">{info.count}</span>
                  </button>
                  
                  {/* ホバーでユーザーID表示 */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                      <div className="font-semibold mb-1">リアクションしたユーザー:</div>
                      {info.users.slice(0, 10).map((user, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getUserColor(user.id) }}
                          />
                          <span>{user.id}</span>
                          {user.isAI && (
                            <span className="text-[10px] bg-indigo-500 px-1.5 py-0.5 rounded-full">🤖AI</span>
                          )}
                        </div>
                      ))}
                      {info.users.length > 10 && (
                        <div className="text-gray-400 mt-1">他 {info.users.length - 10}人</div>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 返信スレッド */}
          {showReplies && replies.length > 0 && (
            <div className="mt-5 space-y-4 pl-4 border-l-2 border-blue-200 bg-blue-50/30 py-3 rounded-r-lg">
              {replies.sort((a, b) => a.created_at - b.created_at).map((reply) => (
                <div key={reply.id} className="flex gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm ring-2 ring-white"
                    style={{ backgroundColor: getUserColor(reply.author_id) }}
                  >
                    {reply.author_id.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">
                          {reply.author_id}
                        </span>
                        <span className="text-gray-400 text-xs">{formatTime(reply.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                    {/* 返信への返信ボタン */}
                    <button
                      onClick={() => onReply(reply.id)}
                      className="text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs font-medium mt-1 ml-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      返信
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
