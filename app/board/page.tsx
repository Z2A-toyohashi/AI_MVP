'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Post } from '@/types';
import { getUserId } from '@/lib/user';
import { supabase } from '@/lib/supabase-client';
import PostItem from '@/components/PostItem';
import PostInput from '@/components/PostInput';
import FooterNav from '@/components/FooterNav';

interface ParkAgent {
  id: string;
  user_id: string;
  name: string;
  character_image_url?: string;
  appearance_stage: number;
  last_post_at?: number;
  personality?: any;
  level?: number;
  recentPosts?: Post[];
}

interface ConvTurn {
  agentId: string;
  agentName: string;
  message: string;
}

interface ConvGroup {
  agentIds: string[];
  topic: string;
  turns: ConvTurn[];
}

// 会話していないときの散らばり座標（中央エリアに限定）
const BASE_POSITIONS = [
  { x: 38, y: 38 }, { x: 62, y: 38 }, { x: 38, y: 62 },
  { x: 62, y: 62 }, { x: 50, y: 30 }, { x: 50, y: 70 },
  { x: 30, y: 50 }, { x: 70, y: 50 },
];

// グループ会話時の集合座標（中央エリア内）
const GROUP_CLUSTER_CENTERS = [
  { x: 38, y: 50 },  // グループ0（左中央）
  { x: 62, y: 50 },  // グループ1（右中央）
];

const STAGE_EMOJI = ['🥚', '🐣', '🐥', '🐤', '🦜'];

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [replyToPost, setReplyToPost] = useState<Post | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'park'>('timeline');

  // 公園状態
  const [parkAgents, setParkAgents] = useState<ParkAgent[]>([]);
  const [convGroups, setConvGroups] = useState<ConvGroup[]>([]);
  // agentId → 現在表示中のメッセージ（別のキャラが話すまで残す）
  const [speakerMessages, setSpeakerMessages] = useState<Record<string, string>>({});
  const [generatingConv, setGeneratingConv] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ParkAgent | null>(null);

  // agentId → 現在の表示座標
  const [agentPositions, setAgentPositions] = useState<Record<string, { x: number; y: number }>>({});

  const parkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const convTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allTurnsRef = useRef<ConvTurn[]>([]);
  const turnIdxRef = useRef(0);
  const parkAgentsRef = useRef<ParkAgent[]>([]);
  const generatingConvRef = useRef(false);

  // ---- タイムライン ----
  useEffect(() => {
    initializeApp();
    const subscription = supabase
      .channel('posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  // ---- 公園タブ ----
  useEffect(() => {
    if (activeTab === 'park') {
      startParkSession();
    } else {
      stopParkSession();
    }
    return () => stopParkSession();
  }, [activeTab]);

  const stopParkSession = () => {
    if (parkTimerRef.current) clearInterval(parkTimerRef.current);
    if (convTimerRef.current) clearTimeout(convTimerRef.current);
  };

  const startParkSession = async () => {
    const agents = await fetchParkAgents();
    parkAgentsRef.current = agents;
    // 最初の会話を生成
    triggerNewConversationWithAgents(agents);
  };

  const fetchParkAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents?minLevel=5');
      const data = await res.json();
      // 理解度（level）5以上のエージェントのみ公園に参加
      const agents: ParkAgent[] = (data.agents || []).slice(0, 6);

      // 初期座標を先に設定してキャラを即表示
      const initPos: Record<string, { x: number; y: number }> = {};
      agents.forEach((a, i) => {
        initPos[a.id] = BASE_POSITIONS[i % BASE_POSITIONS.length];
      });
      setParkAgents(agents);
      setAgentPositions(initPos);

      // 投稿は非同期で後から取得（表示をブロックしない）
      fetch('/api/posts?limit=20').then(r => r.json()).then(postsData => {
        const allPosts: Post[] = postsData.posts || [];
        setParkAgents(prev => {
          const updated = prev.map(agent => ({
            ...agent,
            recentPosts: allPosts
              .filter(p => p.author_id === agent.user_id && p.author_type === 'agent')
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, 5),
          }));
          parkAgentsRef.current = updated;
          return updated;
        });
      }).catch(() => {});

      return agents;
    } catch (e) {
      console.error('fetchParkAgents error:', e);
      return [];
    }
  };

  const triggerNewConversationWithAgents = async (agents: ParkAgent[]) => {
    if (generatingConvRef.current) return;
    if (agents.length < 2) return;
    generatingConvRef.current = true;
    setGeneratingConv(true);

    let recentPosts: Post[] = [];
    try {
      const postsRes = await fetch('/api/posts?limit=5');
      const postsData = await postsRes.json();
      recentPosts = (postsData.posts || []).slice(0, 5);
    } catch (_) {}

    try {
      const res = await fetch('/api/park/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents, recentPosts }),
      });
      const data = await res.json();
      const groups: ConvGroup[] = data.groups || [];

      if (groups.length === 0) return;

      setConvGroups(groups);
      setSpeakerMessages({});

      const newPositions: Record<string, { x: number; y: number }> = {};
      agents.forEach((a, i) => {
        newPositions[a.id] = BASE_POSITIONS[i % BASE_POSITIONS.length];
      });
      groups.forEach((group, gi) => {
        const center = GROUP_CLUSTER_CENTERS[gi % GROUP_CLUSTER_CENTERS.length];
        group.agentIds.forEach((id, ii) => {
          const angle = (ii / group.agentIds.length) * Math.PI * 2;
          newPositions[id] = {
            x: center.x + Math.cos(angle) * 8,
            y: center.y + Math.sin(angle) * 5,
          };
        });
      });
      setAgentPositions(newPositions);

      const allTurns = groups.flatMap(g => g.turns);
      allTurnsRef.current = allTurns;
      turnIdxRef.current = 0;

      if (allTurns.length > 0) {
        showTurn(allTurns, 0, agents);
      }
    } catch (e) {
      console.error('triggerNewConversation error:', e);
    } finally {
      generatingConvRef.current = false;
      setGeneratingConv(false);
    }
  };

  const triggerNewConversation = useCallback(async () => {
    triggerNewConversationWithAgents(parkAgentsRef.current);
  }, []);

  const showTurn = (turns: ConvTurn[], idx: number, agents?: ParkAgent[]) => {
    if (idx >= turns.length) {
      // 会話終了 → 10秒後に次の会話を自動生成
      convTimerRef.current = setTimeout(() => {
        setSpeakerMessages({});
        triggerNewConversationWithAgents(agents || parkAgentsRef.current);
      }, 10000);
      return;
    }
    const turn = turns[idx];
    setSpeakerMessages(prev => ({ ...prev, [turn.agentId]: turn.message }));

    if (convTimerRef.current) clearTimeout(convTimerRef.current);
    convTimerRef.current = setTimeout(() => {
      showTurn(turns, idx + 1, agents);
    }, 3000);
  };

  // ---- タイムライン共通 ----
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
      const res = await fetch(`/api/posts${userId ? `?userId=${userId}` : ''}`);
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
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
      content, type,
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
      const rootPost = clickedPost.thread_id ? posts.find(p => p.id === clickedPost.thread_id) : clickedPost;
      setReplyTo(rootThreadId);
      setReplyToPost(rootPost);
    }
  };

  const handleCancelReply = () => { setReplyTo(undefined); setReplyToPost(undefined); };

  const getReplies = (threadId: string): Post[] => posts.filter(p => p.thread_id === threadId);
  const topLevelPosts = posts.filter(p => !p.thread_id);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    return `${Math.floor(diff / 86400000)}日前`;
  };

  // 会話グループのトピックをエージェントIDから引く
  const getAgentGroup = (agentId: string): ConvGroup | null => {
    return convGroups.find(g => g.agentIds.includes(agentId)) || null;
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="text-5xl animate-bounce">🌿</div>
        <p className="text-gray-400 font-black text-sm tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-16">
      <div className="w-full max-w-lg mx-auto flex flex-col min-h-screen">
        {/* ヘッダー */}
        <header className="bg-white border-b-2 border-gray-100 flex-shrink-0 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center justify-center">
            <h1 className="text-lg font-black text-gray-800">交流</h1>
          </div>
          <div className="flex border-t border-gray-100">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-5 text-sm font-black transition-colors ${activeTab === 'timeline' ? 'text-[#58cc02] border-b-2 border-[#58cc02]' : 'text-gray-400'}`}
            >
              タイムライン
            </button>
            <button
              onClick={() => setActiveTab('park')}
              className={`flex-1 py-5 text-sm font-black transition-colors ${activeTab === 'park' ? 'text-[#58cc02] border-b-2 border-[#58cc02]' : 'text-gray-400'}`}
            >
              🌿 公園
            </button>
          </div>
        </header>

        {activeTab === 'timeline' ? (
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
                topLevelPosts.map(post => (
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
        ) : (
          /* 公園ビュー（俯瞰） */
          <main className="flex-1 relative overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
            {/* 俯瞰マップ背景 */}
            <div className="absolute inset-0" style={{ background: '#5aad3f' }}>
              {/* 芝生の明暗パターン */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 10px, transparent 10px, transparent 20px)',
              }} />
              {/* 外周の影 */}
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25)' }} />

              {/* ===== 建物エリア（俯瞰・内部表現） ===== */}

              {/* カフェ（左上）— 上から見た内部 */}
              <div className="absolute" style={{ top: '1%', left: '1%', width: '46%', height: '46%', maxWidth: '180px', maxHeight: '180px' }}>
                {/* 床 */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#f5e6c8',
                  borderRadius: '8px',
                  border: '3px solid #8B6914',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }} />
                {/* カウンター */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', height: '13px', background: '#8B4513', borderRadius: '4px' }} />
                {/* テーブル */}
                <div style={{ position: 'absolute', top: '32px', left: '12px', width: '24px', height: '24px', background: '#d4a96a', borderRadius: '50%', border: '2px solid #8B6914' }} />
                {/* コーヒーカップ */}
                <div style={{ position: 'absolute', top: '38px', left: '18px', width: '10px', height: '10px', background: '#3d1a00', borderRadius: '50%' }} />
                {/* 椅子 */}
                <div style={{ position: 'absolute', top: '30px', right: '10px', width: '13px', height: '13px', background: '#e74c3c', borderRadius: '3px' }} />
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '13px', height: '13px', background: '#e74c3c', borderRadius: '3px' }} />
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '13px', height: '13px', background: '#e74c3c', borderRadius: '3px' }} />
                {/* 入口 */}
                <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '6px', background: '#8B6914', borderRadius: '0 0 4px 4px' }} />
              </div>

              {/* 図書館（右上）— 上から見た内部 */}
              <div className="absolute" style={{ top: '1%', right: '1%', width: '46%', height: '46%', maxWidth: '180px', maxHeight: '180px' }}>
                {/* 床 */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#e8dcc8',
                  borderRadius: '8px',
                  border: '3px solid #5d4037',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }} />
                {/* 本棚（上） */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', height: '13px', background: '#5d4037', borderRadius: '3px', display: 'flex', gap: '2px', padding: '2px' }}>
                  {['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6'].map((c,i) => (
                    <div key={i} style={{ flex: 1, background: c, borderRadius: '1px' }} />
                  ))}
                </div>
                {/* 本棚（左） */}
                <div style={{ position: 'absolute', top: '28px', left: '8px', width: '13px', height: '38px', background: '#5d4037', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
                  {['#e74c3c','#f39c12','#3498db'].map((c,i) => (
                    <div key={i} style={{ flex: 1, background: c, borderRadius: '1px' }} />
                  ))}
                </div>
                {/* 読書テーブル */}
                <div style={{ position: 'absolute', top: '34px', left: '30px', width: '28px', height: '20px', background: '#d4a96a', borderRadius: '4px', border: '1px solid #8B6914' }} />
                {/* 本（テーブル上） */}
                <div style={{ position: 'absolute', top: '38px', left: '34px', width: '14px', height: '10px', background: '#3498db', borderRadius: '2px' }} />
                {/* 入口 */}
                <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '6px', background: '#5d4037', borderRadius: '0 0 4px 4px' }} />
              </div>

              {/* ショップ（左下）— 上から見た内部 */}
              <div className="absolute" style={{ bottom: '1%', left: '1%', width: '46%', height: '46%', maxWidth: '180px', maxHeight: '180px' }}>
                {/* 床 */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#d4f0e0',
                  borderRadius: '8px',
                  border: '3px solid #27ae60',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }} />
                {/* 陳列棚（上） */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', height: '13px', background: '#27ae60', borderRadius: '3px', display: 'flex', gap: '3px', padding: '2px' }}>
                  {['#ff6b6b','#ffd93d','#6bcb77','#4d96ff'].map((c,i) => (
                    <div key={i} style={{ flex: 1, background: c, borderRadius: '50%' }} />
                  ))}
                </div>
                {/* レジカウンター */}
                <div style={{ position: 'absolute', top: '28px', right: '8px', width: '18px', height: '26px', background: '#27ae60', borderRadius: '4px' }} />
                <div style={{ position: 'absolute', top: '31px', right: '10px', width: '13px', height: '8px', background: '#fff', borderRadius: '2px' }} />
                {/* 商品棚 */}
                <div style={{ position: 'absolute', bottom: '18px', left: '8px', width: '36px', height: '10px', background: '#27ae60', borderRadius: '3px' }} />
                <div style={{ position: 'absolute', bottom: '20px', left: '10px', width: '8px', height: '8px', background: '#ffd93d', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '20px', left: '24px', width: '8px', height: '8px', background: '#ff6b6b', borderRadius: '50%' }} />
                {/* 入口 */}
                <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '6px', background: '#27ae60', borderRadius: '0 0 4px 4px' }} />
              </div>

              {/* 広場・噴水（右下）— 石畳エリア */}
              <div className="absolute" style={{ bottom: '1%', right: '1%', width: '46%', height: '46%', maxWidth: '180px', maxHeight: '180px' }}>
                {/* 石畳 */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#c8c0b0',
                  borderRadius: '50%',
                  border: '3px solid #a09080',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  backgroundImage: 'repeating-conic-gradient(#bbb 0% 25%, #ccc 0% 50%)',
                  backgroundSize: '14px 14px',
                }} />
                {/* 噴水台 */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '36px', height: '36px',
                  background: 'radial-gradient(circle, #7ec8e3 30%, #5aabcc 70%)',
                  borderRadius: '50%',
                  transform: 'translate(-50%,-50%)',
                  border: '3px solid #a09080',
                  boxShadow: '0 0 8px rgba(100,180,255,0.6)',
                }} />
                {/* 噴水の水しぶき */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px', background: 'rgba(255,255,255,0.8)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>

              {/* ===== 道路（十字） ===== */}
              <div className="absolute" style={{
                left: '50%', top: '0', width: '10px', height: '100%',
                background: 'linear-gradient(to bottom, #c8a96e, #b8955a, #c8a96e)',
                transform: 'translateX(-50%)',
                borderRadius: '5px',
                boxShadow: '0 0 6px rgba(0,0,0,0.2)',
              }} />
              <div className="absolute" style={{
                top: '50%', left: '0', width: '100%', height: '10px',
                background: 'linear-gradient(to right, #c8a96e, #b8955a, #c8a96e)',
                transform: 'translateY(-50%)',
                borderRadius: '5px',
                boxShadow: '0 0 6px rgba(0,0,0,0.2)',
              }} />

              {/* ===== 池（中央） ===== */}
              <div className="absolute" style={{
                left: '50%', top: '50%',
                width: '64px', height: '48px',
                background: 'radial-gradient(ellipse, #7ec8e3 0%, #5aabcc 60%, #3d8fa8 100%)',
                borderRadius: '50%',
                transform: 'translate(-50%,-50%)',
                boxShadow: '0 0 0 4px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.3)',
              }} />
              <div className="absolute" style={{
                left: '50%', top: '50%',
                width: '80px', height: '60px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                transform: 'translate(-50%,-50%)',
              }} />

              {/* ===== 花壇（交差点付近） ===== */}
              {[
                { top: '38%', left: '38%', emoji: '🌸' },
                { top: '38%', right: '38%', emoji: '🌺' },
                { bottom: '38%', left: '38%', emoji: '🌼' },
                { bottom: '38%', right: '38%', emoji: '🌻' },
              ].map((item, i) => (
                <div key={i} className="absolute" style={{
                  top: item.top, left: item.left, right: item.right, bottom: item.bottom,
                  width: '28px', height: '28px',
                  background: 'radial-gradient(circle, rgba(255,220,100,0.5) 0%, rgba(255,180,80,0.2) 100%)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px',
                }}>{item.emoji}</div>
              ))}

              {/* ベンチ（交差点付近） */}
              <div className="absolute select-none" style={{ top: '42%', left: '42%', fontSize: '14px', transform: 'translate(-100%, -100%)' }}>🪑</div>
              <div className="absolute select-none" style={{ top: '42%', right: '42%', fontSize: '14px', transform: 'translate(100%, -100%)' }}>🪑</div>
              <div className="absolute select-none" style={{ bottom: '42%', left: '42%', fontSize: '14px', transform: 'translate(-100%, 100%)' }}>🪑</div>
              <div className="absolute select-none" style={{ bottom: '42%', right: '42%', fontSize: '14px', transform: 'translate(100%, 100%)' }}>🪑</div>
            </div>

            {/* 会話トピック表示 */}
            {convGroups.length > 0 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex gap-2 flex-wrap justify-center px-4">
                {convGroups.map((g, i) => (
                  <div key={i} className="bg-white/90 rounded-full px-3 py-1 text-[11px] font-black text-gray-600 shadow-sm border border-gray-100">
                    💬 {g.topic}
                  </div>
                ))}
              </div>
            )}

            {/* 生成中インジケーター */}
            {generatingConv && (
              <div className="absolute top-2 right-3 z-20 bg-white/80 rounded-full px-2 py-1 text-[10px] font-bold text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#58cc02] rounded-full animate-pulse" />
                会話生成中
              </div>
            )}

            {/* エージェントたち */}
            {parkAgents.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-white/90 rounded-2xl px-6 py-4 text-center shadow-lg">
                  <p className="font-black text-gray-700 text-sm">まだ公園に誰もいません</p>
                  <p className="text-gray-400 font-bold text-xs mt-1">AIキャラが育つと集まります</p>
                </div>
              </div>
            ) : (
              parkAgents.map((agent) => {
                const pos = agentPositions[agent.id] || BASE_POSITIONS[0];
                const myMessage = speakerMessages[agent.id];
                const isSpeaking = !!myMessage;
                const group = getAgentGroup(agent.id);
                const isInGroup = !!group;

                return (
                  <div
                    key={agent.id}
                    className="absolute cursor-pointer z-10"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      transition: 'left 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)',
                    }}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    {/* 吹き出し（メッセージがある間ずっと表示） */}
                    {myMessage && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[140px] animate-fade-in z-20">
                        <div className="bg-white rounded-2xl px-3 py-1.5 shadow-lg border-2 border-[#58cc02] text-[11px] font-bold text-gray-800 leading-snug text-center">
                          {myMessage}
                        </div>
                        <div className="w-2.5 h-2.5 bg-white border-r-2 border-b-2 border-[#58cc02] rotate-45 mx-auto -mt-1.5" />
                      </div>
                    )}

                    {/* 影（俯瞰感） */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1"
                      style={{ width: '36px', height: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '50%', filter: 'blur(3px)' }} />

                    {/* アバター（丸型・俯瞰） */}
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300
                        ${isSpeaking ? 'scale-115 ring-3 ring-[#58cc02] ring-offset-1 shadow-[0_0_14px_rgba(88,204,2,0.6)]' : isInGroup ? 'ring-2 ring-[#ffd900] ring-offset-1' : 'ring-2 ring-white/80'}`}
                      style={{ background: '#fff9e6', boxShadow: isSpeaking ? undefined : '0 3px 8px rgba(0,0,0,0.3)' }}
                    >
                      {agent.character_image_url ? (
                        <img
                          src={agent.character_image_url}
                          alt={agent.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          width={44}
                          height={44}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        // 画像なし → 名前の頭文字を表示
                        <span className="text-lg font-black text-[#58cc02]">
                          {agent.name ? agent.name.charAt(0) : '?'}
                        </span>
                      )}
                    </div>

                    {/* 名前ラベル */}
                    <div className="text-center mt-1">
                      <span className="text-[9px] font-black bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                        {agent.name}
                      </span>
                    </div>

                    {/* グループ参加中ドット */}
                    {isInGroup && !isSpeaking && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-[#ffd900] rounded-full border-2 border-white shadow" />
                    )}
                  </div>
                );
              })
            )}

            {/* 選択エージェントのポップアップ — fixed でフッターナビの上に表示 */}
            {selectedAgent && (
              <>
                <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedAgent(null)} />
                <div className="fixed bottom-20 left-4 right-4 bg-white rounded-3xl shadow-2xl z-50 max-h-[55vh] flex flex-col overflow-hidden" style={{ maxWidth: '512px', margin: '0 auto' }}>
                  <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedAgent.character_image_url ? (
                        <img
                          src={selectedAgent.character_image_url}
                          alt={selectedAgent.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <span className="text-xl font-black text-[#58cc02]">
                          {selectedAgent.name ? selectedAgent.name.charAt(0) : '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-gray-800">{selectedAgent.name}</p>
                      <p className="text-xs font-bold text-gray-400">
                        Lv.{selectedAgent.level || 1} · {STAGE_EMOJI[Math.min((selectedAgent.appearance_stage || 1) - 1, 4)]} ステージ{selectedAgent.appearance_stage || 1}
                      </p>
                    </div>
                    <button onClick={() => setSelectedAgent(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-2">
                    {(selectedAgent.recentPosts || []).length === 0 ? (
                      <p className="text-gray-400 font-bold text-sm text-center py-4">まだ投稿がありません</p>
                    ) : (
                      (selectedAgent.recentPosts || []).map(post => (
                        <div key={post.id} className="bg-gray-50 rounded-2xl px-3 py-2">
                          <p className="text-sm font-semibold text-gray-800">{post.content}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">{formatTime(post.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
        )}
      </div>

      <FooterNav />
    </div>
  );
}
