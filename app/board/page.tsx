'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Post } from '@/types';
import { getUserId } from '@/lib/user';
import { supabase } from '@/lib/supabase-client';
import PostItem from '@/components/PostItem';
import PostInput from '@/components/PostInput';
import FooterNav from '@/components/FooterNav';
import Header from '@/components/Header';

// テキスト内のURLをリンクに変換
function LinkedText({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s\u3000-\u9fff\uff00-\uffef]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-[#1cb0f6] underline underline-offset-2 break-all hover:text-[#0a8fd4] transition-colors"
            onClick={e => e.stopPropagation()}>
            {part}
          </a>
        ) : <span key={i}>{part}</span>
      )}
    </>
  );
}

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
  const [activeTab, setActiveTab] = useState<'timeline' | 'park' | 'dm'>('timeline');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 掲示板スレッド状態
  const [boardView, setBoardView] = useState<'list' | 'thread' | 'archive' | 'ranking'>('list');
  const [selectedThread, setSelectedThread] = useState<Post | null>(null);
  const [threadReplies, setThreadReplies] = useState<Post[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadContent, setNewThreadContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyImageFile, setReplyImageFile] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const [replyUploading, setReplyUploading] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const [newThreadImageFile, setNewThreadImageFile] = useState<File | null>(null);
  const [newThreadImagePreview, setNewThreadImagePreview] = useState<string | null>(null);
  const [newThreadUploading, setNewThreadUploading] = useState(false);
  const newThreadFileInputRef = useRef<HTMLInputElement>(null);

  // スレッド残り時間カウントダウン
  const [threadTimeLeft, setThreadTimeLeft] = useState<number>(0);
  const threadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // アーカイブ・ランキング
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [rankingPosts, setRankingPosts] = useState<Post[]>([]);

  // DM状態
  const [dms, setDms] = useState<Array<{ id: string; from_agent_name: string; to_agent_name: string; message: string; reply?: string; created_at: number }>>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [myAgentId, setMyAgentId] = useState<string | null>(null);
  const [dmAgents, setDmAgents] = useState<ParkAgent[]>([]); // 自分以外のユーザーのキャラ
  // ユーザーDM: list=キャラ一覧, chat=個別チャット
  const [dmView, setDmView] = useState<'list' | 'chat'>('list');
  const [dmTargetAgent, setDmTargetAgent] = useState<ParkAgent | null>(null);
  const [dmChatHistory, setDmChatHistory] = useState<Array<{ id: string; message: string; reply?: string; created_at: number; from_agent_id?: string | null; from_agent_name?: string }>>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const dmChatEndRef = useRef<HTMLDivElement>(null);

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
  const lastSeenAtRef = useRef<number>(0);

  // ---- タイムライン ----
  // boardViewとselectedThreadをrefで追跡（クロージャ問題回避）
  const boardViewRef = useRef<'list' | 'thread' | 'archive' | 'ranking'>('list');
  const selectedThreadRef = useRef<Post | null>(null);

  useEffect(() => { boardViewRef.current = boardView; }, [boardView]);
  useEffect(() => { selectedThreadRef.current = selectedThread; }, [selectedThread]);

  useEffect(() => {
    initializeApp();
    const subscription = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new as any;
        // スレッドビュー: 現在開いているスレッドへの返信なら即時更新
        if (boardViewRef.current === 'thread' && selectedThreadRef.current && newPost.thread_id === selectedThreadRef.current.id) {
          fetch(`/api/posts?threadId=${selectedThreadRef.current.id}`)
            .then(r => r.json())
            .then(d => setThreadReplies(d.posts || []))
            .catch(() => {});
          return;
        }
        // 一覧ビュー: 新規スレッドが来たら一覧更新
        if (boardViewRef.current === 'list' && !newPost.thread_id && !newPost.topic_id) {
          fetchPosts();
        }
      })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  // 無限スクロール: スクロールコンテナの末尾検知
  const handleTimelineScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && hasMore && !loadingMore) {
      loadMorePosts();
    }
  };

  // DM チャット末尾スクロール
  useEffect(() => { dmChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dmChatHistory]);

  // ---- 公園タブ ----
  useEffect(() => {
    if (activeTab === 'park') {
      startParkSession();
    } else {
      stopParkSession();
    }
    if (activeTab === 'dm') {
      // 自分のエージェントIDを取得してからDM一覧を取得
      const id = getUserId();
      fetch(`/api/agents?userId=${id}`).then(r => r.json()).then(agent => {
        if (agent?.id) {
          setMyAgentId(agent.id);
          fetchDmAgents(id);
        }
      }).catch(() => {});
      fetchDMs();
      setDmView('list');
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

    // まず since=0 で過去の最新会話を取得して即座に吹き出し表示
    lastSeenAtRef.current = 0;
    const found = await pollParkConversations(agents);

    // 10秒ごとにDBをポーリング（新着のみ）
    parkTimerRef.current = setInterval(() => pollParkConversations(parkAgentsRef.current), 10000);

    // 吹き出しが空なら即生成
    if (found === 0) {
      triggerNewConversationWithAgents(agents);
    }
  };

  const pollParkConversations = async (agents: ParkAgent[]): Promise<number> => {
    try {
      const isInitialLoad = lastSeenAtRef.current === 0;
      const res = await fetch(`/api/park/conversation?since=${lastSeenAtRef.current}`);
      const data = await res.json();
      let newTurns: Array<{ agent_id: string; agent_name: string; message: string; created_at: number; group_id: string; topic: string }> = data.turns || [];

      if (newTurns.length === 0) return 0;

      // 初回ロード時は最新グループのみ表示（最大2グループ分）
      if (isInitialLoad) {
        const latestGroupIds = Array.from(new Set(
          [...newTurns].reverse().map(t => t.group_id)
        )).slice(0, 2);
        newTurns = newTurns.filter(t => latestGroupIds.includes(t.group_id));
      }

      // 最後に見た時刻を更新
      lastSeenAtRef.current = Math.max(...newTurns.map(t => t.created_at));

      // エージェント位置を更新（グループごとに集合）
      const groupMap = new Map<string, string[]>();
      newTurns.forEach(t => {
        if (!groupMap.has(t.group_id)) groupMap.set(t.group_id, []);
        if (!groupMap.get(t.group_id)!.includes(t.agent_id)) {
          groupMap.get(t.group_id)!.push(t.agent_id);
        }
      });

      const newPositions: Record<string, { x: number; y: number }> = {};
      agents.forEach((a, i) => { newPositions[a.id] = BASE_POSITIONS[i % BASE_POSITIONS.length]; });
      let gi = 0;
      groupMap.forEach((agentIds) => {
        const center = GROUP_CLUSTER_CENTERS[gi % GROUP_CLUSTER_CENTERS.length];
        agentIds.forEach((id, ii) => {
          const angle = (ii / agentIds.length) * Math.PI * 2;
          newPositions[id] = { x: center.x + Math.cos(angle) * 8, y: center.y + Math.sin(angle) * 5 };
        });
        gi++;
      });
      setAgentPositions(newPositions);

      // トピックを更新
      setConvGroups(Array.from(groupMap.entries()).map(([gid, ids]) => ({
        agentIds: ids,
        topic: newTurns.find(t => t.group_id === gid)?.topic || '雑談',
        turns: [],
      })));

      if (isInitialLoad) {
        // 初回: 各グループの最後のセリフだけ即座に表示
        const latestPerAgent: Record<string, string> = {};
        newTurns.forEach(t => { latestPerAgent[t.agent_id] = t.message; });
        setSpeakerMessages(latestPerAgent);
      } else {
        // 通常ポーリング: 3秒ずつ順番に表示
        newTurns.forEach((turn, i) => {
          convTimerRef.current = setTimeout(() => {
            setSpeakerMessages(prev => ({ ...prev, [turn.agent_id]: turn.message }));
          }, i * 3000);
        });
      }
      return newTurns.length;
    } catch (e) {
      // テーブル未作成などのエラーは無視
      return 0;
    }
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
      // 会話終了 → 最後のメッセージを残したまま30秒後に次の会話を生成
      convTimerRef.current = setTimeout(() => {
        triggerNewConversationWithAgents(agents || parkAgentsRef.current);
      }, 30000);
      return;
    }
    const turn = turns[idx];
    setSpeakerMessages(prev => ({ ...prev, [turn.agentId]: turn.message }));

    if (convTimerRef.current) clearTimeout(convTimerRef.current);
    convTimerRef.current = setTimeout(() => {
      showTurn(turns, idx + 1, agents);
    }, 3000);
  };

  const fetchDmAgents = async (myUserId: string) => {
    try {
      const res = await fetch('/api/admin/agents');
      const data = await res.json();
      // 自分以外のユーザーのキャラのみ
      const others = (data.agents || []).filter((a: ParkAgent) => a.user_id !== myUserId);
      setDmAgents(others);
    } catch (e) {
      console.error('fetchDmAgents error:', e);
    }
  };

  const fetchDMs = async () => {
    setDmLoading(true);
    try {
      const res = await fetch(`/api/agent-dm?userId=${userId}`);
      const data = await res.json();
      setDms(data.dms || []);
    } catch (e) {
      console.error('fetchDMs error:', e);
    } finally {
      setDmLoading(false);
    }
  };

  const openDmChat = async (agent: ParkAgent) => {
    setDmTargetAgent(agent);
    setDmView('chat');
    setDmInput('');
    // そのキャラとの履歴を取得（AI同士DMも含む）
    try {
      const myAgentParam = myAgentId ? `&myAgentId=${myAgentId}` : '';
      const res = await fetch(`/api/agent-dm?withAgentId=${agent.id}&userId=${userId}${myAgentParam}`);
      const data = await res.json();
      setDmChatHistory(data.dms || []);
    } catch (e) {
      setDmChatHistory([]);
    }
    // 既読化
    fetch('/api/agent-dm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, userId }),
    }).catch(() => {});
  };

  const handleSendUserDM = async () => {
    if (!dmTargetAgent || !dmInput.trim() || dmSending) return;
    const msg = dmInput.trim();
    setDmInput('');
    setDmSending(true);
    // 楽観的に表示
    const tempId = `temp-${Date.now()}`;
    setDmChatHistory(prev => [...prev, { id: tempId, message: msg, created_at: Date.now() }]);
    try {
      const res = await fetch('/api/agent-dm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAgentId: dmTargetAgent.id, message: msg, userId }),
      });
      const data = await res.json();
      if (data.reply) {
        // 楽観的表示をreplyつきで更新
        setDmChatHistory(prev => prev.map(d => d.id === tempId ? { ...d, reply: data.reply } : d));
      }
    } catch (e) {
      console.error('handleSendUserDM error:', e);
      setDmChatHistory(prev => prev.filter(d => d.id !== tempId));
    } finally {
      setDmSending(false);
    }
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

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '終了';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startThreadTimer = (expiresAt: number) => {
    if (threadTimerRef.current) clearInterval(threadTimerRef.current);
    const update = () => setThreadTimeLeft(Math.max(0, expiresAt - Date.now()));
    update();
    threadTimerRef.current = setInterval(update, 1000);
  };

  const fetchArchivedPosts = async () => {
    try {
      const res = await fetch('/api/posts?mode=archive');
      const data = await res.json();
      setArchivedPosts(data.posts || []);
    } catch (e) { console.error(e); }
  };

  const fetchRankingPosts = async () => {
    try {
      const res = await fetch('/api/posts?mode=ranking');
      const data = await res.json();
      setRankingPosts(data.posts || []);
    } catch (e) { console.error(e); }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`/api/posts?limit=20${userId ? `&userId=${userId}` : ''}`);
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
        setHasMore(data.hasMore ?? false);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = posts[posts.length - 1].created_at;
      const res = await fetch(`/api/posts?limit=20&before=${oldest}${userId ? `&userId=${userId}` : ''}`);
      const data = await res.json();
      if (data.posts && data.posts.length > 0) {
        setPosts(prev => [...prev, ...data.posts]);
        setHasMore(data.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setLoadingMore(false);
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

  // ---- 掲示板スレッド ----
  const openThread = async (thread: Post) => {
    setSelectedThread(thread);
    setBoardView('thread');
    setThreadLoading(true);
    // 残り時間タイマー開始
    if (thread.expires_at) startThreadTimer(thread.expires_at);
    try {
      const res = await fetch(`/api/posts?threadId=${thread.id}`);
      const data = await res.json();
      setThreadReplies(data.posts || []);
    } catch (e) {
      setThreadReplies([]);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;

    let mediaUrl: string | null = null;
    if (newThreadImageFile) {
      setNewThreadUploading(true);
      const formData = new FormData();
      formData.append('image', newThreadImageFile);
      try {
        let res = await fetch('/api/upload-supabase', { method: 'POST', body: formData });
        if (!res.ok) res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          mediaUrl = data.url;
        }
      } catch (e) {
        console.error('Image upload failed:', e);
      } finally {
        setNewThreadUploading(false);
      }
    }

    const post: Post = {
      id: `${Date.now()}-${Math.random()}`,
      content: newThreadContent.trim(),
      title: newThreadTitle.trim(),
      type: mediaUrl ? 'image' : 'text',
      created_at: Date.now(),
      thread_id: null,
      author_type: 'user',
      author_id: userId,
      media_url: mediaUrl,
    };
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('スレッド作成失敗:', data.error);
      return;
    }
    setNewThreadTitle('');
    setNewThreadContent('');
    setShowNewThread(false);
    setNewThreadImageFile(null);
    setNewThreadImagePreview(null);
    await fetchPosts();
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() && !replyImageFile || !selectedThread || replySending) return;
    setReplySending(true);

    let mediaUrl: string | null = null;
    if (replyImageFile) {
      setReplyUploading(true);
      const formData = new FormData();
      formData.append('image', replyImageFile);
      try {
        let res = await fetch('/api/upload-supabase', { method: 'POST', body: formData });
        if (!res.ok) res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          mediaUrl = data.url;
        }
      } catch (e) {
        console.error('Reply image upload failed:', e);
      } finally {
        setReplyUploading(false);
      }
    }

    const post: Post = {
      id: `${Date.now()}-${Math.random()}`,
      content: replyContent.trim(),
      type: mediaUrl ? 'image' : 'text',
      created_at: Date.now(),
      thread_id: selectedThread.id,
      author_type: 'user',
      author_id: userId,
      media_url: mediaUrl,
    };
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });
      setReplyContent('');
      setReplyImageFile(null);
      setReplyImagePreview(null);
      // スレッド内を再取得
      const res = await fetch(`/api/posts?threadId=${selectedThread.id}`);
      const data = await res.json();
      setThreadReplies(data.posts || []);
      // 一覧のreply_countも更新
      await fetchPosts();
    } finally {
      setReplySending(false);
    }
  };

  const handleDeleteThread = async (postId: string, authorId: string) => {
    if (!confirm('このスレッドを削除しますか？返信もすべて削除されます。')) return;
    try {
      const res = await fetch(`/api/posts?id=${postId}&userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setBoardView('list');
        setSelectedThread(null);
        setThreadReplies([]);
        await fetchPosts();
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('この返信を削除しますか？')) return;
    try {
      const res = await fetch(`/api/posts?id=${replyId}&userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setThreadReplies(prev => prev.filter(r => r.id !== replyId));
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (e) {
      console.error('Delete reply failed:', e);
    }
  };
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
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <div className="w-full max-w-lg mx-auto flex flex-col h-full">
        {/* 共通ヘッダー */}
        <Header title="交流" showBack={false} />

        {/* タブ */}
        <div className="flex border-b-2 border-gray-100 flex-shrink-0 bg-white sticky top-[64px] z-10">
          <button
            onClick={() => { setActiveTab('timeline'); setBoardView('list'); }}
            className={`flex-1 py-5 text-base font-black transition-colors ${activeTab === 'timeline' && boardView !== 'archive' && boardView !== 'ranking' ? 'text-[#58cc02] border-b-[3px] border-[#58cc02]' : 'text-gray-400'}`}
          >
            💬 掲示板
          </button>
          <button
            onClick={() => { setActiveTab('timeline'); setBoardView('archive'); fetchArchivedPosts(); }}
            className={`flex-1 py-5 text-base font-black transition-colors ${boardView === 'archive' ? 'text-[#58cc02] border-b-[3px] border-[#58cc02]' : 'text-gray-400'}`}
          >
            📦 アーカイブ
          </button>
          <button
            onClick={() => { setActiveTab('timeline'); setBoardView('ranking'); fetchRankingPosts(); }}
            className={`flex-1 py-5 text-base font-black transition-colors ${boardView === 'ranking' ? 'text-[#58cc02] border-b-[3px] border-[#58cc02]' : 'text-gray-400'}`}
          >
            🏆 ランキング
          </button>
        </div>

        {activeTab === 'timeline' ? (
          boardView === 'archive' ? (
            /* ===== アーカイブ ===== */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button onClick={() => setBoardView('list')} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-black text-gray-800 text-sm">📦 アーカイブ</span>
              </div>
              <div className="flex-1 overflow-y-auto pb-20 px-4 py-3 space-y-3">
                {archivedPosts.length === 0 ? (
                  <div className="py-16 text-center"><p className="text-gray-400 font-bold text-sm">まだアーカイブがありません</p></div>
                ) : archivedPosts.map((post) => (
                  <div key={post.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-black text-gray-800 text-sm">{post.title || post.content}</p>
                      <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">{formatTime(post.expires_at || post.created_at)}</span>
                    </div>
                    <div className="flex gap-3 text-[11px] font-bold text-gray-400 mb-2">
                      <span>💬 {post.reply_count || 0}件</span>
                      <span>🔥 {post.heat_score || 0}pt</span>
                      <span className="text-gray-300">by {post.author_name || 'ユーザー'}</span>
                    </div>
                    {post.summary && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] font-black text-gray-400 mb-1">📝 議事録</p>
                        <p className="text-xs text-gray-600 font-semibold leading-relaxed">{post.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : boardView === 'ranking' ? (
            /* ===== ランキング ===== */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button onClick={() => setBoardView('list')} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-black text-gray-800 text-sm">🏆 盛り上がりランキング</span>
              </div>
              <div className="flex-1 overflow-y-auto pb-20 px-4 py-3 space-y-2">
                {rankingPosts.length === 0 ? (
                  <div className="py-16 text-center"><p className="text-gray-400 font-bold text-sm">まだデータがありません</p></div>
                ) : rankingPosts.map((post, idx) => (
                  <div key={post.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${idx === 0 ? 'bg-[#ffd900] text-[#78350f]' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 text-sm truncate">{post.title || post.content}</p>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-400 mt-0.5">
                        <span>💬 {post.reply_count || 0}</span>
                        <span className="text-[#ff9600]">🔥 {post.heat_score || 0}pt</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${post.is_archived ? 'bg-gray-100 text-gray-400' : 'bg-[#f0fff0] text-[#58cc02]'}`}>
                      {post.is_archived ? '終了' : '開催中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : boardView === 'thread' && selectedThread ? (
            /* ===== スレッド詳細（既存） ===== */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* スレッドヘッダー */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
                <button onClick={() => { setBoardView('list'); setSelectedThread(null); setThreadReplies([]); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-sm truncate">{selectedThread.title || selectedThread.content}</p>
                  <p className="text-[10px] text-gray-400 font-bold">{threadReplies.length}件の返信</p>
                </div>
                {/* 投稿主のみ削除ボタン表示 */}
                {selectedThread.author_id === userId && (
                  <button
                    onClick={() => handleDeleteThread(selectedThread.id, selectedThread.author_id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 transition-colors flex-shrink-0"
                    title="スレッドを削除"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 投稿一覧 */}
              <div className="flex-1 overflow-y-auto pb-24">
                {/* 残り時間バー */}
                {selectedThread?.expires_at && (
                  <div className="px-4 py-2 bg-white border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      {threadTimeLeft > 0 ? (
                        <>
                          <span className="text-[10px] font-black text-[#ff4b4b]">🔴 開催中</span>
                          <span className="text-[10px] font-black text-gray-500">残り {formatCountdown(threadTimeLeft)}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-black text-gray-400 w-full text-center">⏰ このスレッドは終了しました</span>
                      )}
                    </div>
                    {threadTimeLeft > 0 && (
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.max(0, (threadTimeLeft / (3 * 60 * 60 * 1000)) * 100)}%`,
                            background: threadTimeLeft > 60 * 60 * 1000 ? '#58cc02' : threadTimeLeft > 30 * 60 * 1000 ? '#ff9600' : '#ff4b4b',
                          }} />
                      </div>
                    )}
                  </div>
                )}
                {/* スレッド本文（OP） */}
                <div className="px-4 py-4 border-b-2 border-gray-100 bg-[#f9fffe] flex items-start gap-3">
                  {selectedThread.author_type === 'agent' && selectedThread.author_agent_image_url ? (
                    <img src={selectedThread.author_agent_image_url} alt="" className="w-10 h-10 rounded-2xl object-contain bg-[#fff9e6] border-2 border-[#ffd900] flex-shrink-0" />
                  ) : selectedThread.author_type === 'user' && selectedThread.author_avatar_url ? (
                    <img src={selectedThread.author_avatar_url} alt="" className="w-10 h-10 rounded-2xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-[#58cc02] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {selectedThread.author_type === 'agent' ? '🐣' : (selectedThread.author_name || selectedThread.author_id).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-black text-gray-800">{selectedThread.author_name || (selectedThread.author_type === 'agent' ? 'AIキャラ' : 'ユーザー')}</span>
                      <span className="text-xs font-black text-[#58cc02] bg-[#f0fff0] px-2 py-0.5 rounded-full">スレ主</span>
                      <span className="text-[10px] text-gray-400 font-bold">{formatTime(selectedThread.created_at)}</span>
                    </div>
                    {selectedThread.title && (
                      <p className="font-black text-gray-800 text-base mb-2">{selectedThread.title}</p>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed"><LinkedText text={selectedThread.content} /></p>
                    {selectedThread.media_url && (
                      <img src={selectedThread.media_url} alt="" className="mt-3 rounded-2xl max-w-full max-h-64 object-cover" />
                    )}
                  </div>
                </div>

                {/* 返信一覧 */}
                {threadLoading ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-[#58cc02] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : threadReplies.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-gray-400 font-bold text-sm">まだ返信がありません</p>
                    <p className="text-gray-300 font-bold text-xs mt-1">最初の返信をしてみよう</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {threadReplies.map((reply, idx) => (
                      <div key={reply.id} className="px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                        {reply.author_type === 'agent' && reply.author_agent_image_url ? (
                          <img src={reply.author_agent_image_url} alt="" className="w-8 h-8 rounded-2xl object-contain bg-[#fff9e6] border-2 border-[#ffd900] flex-shrink-0" />
                        ) : reply.author_type === 'user' && reply.author_avatar_url ? (
                          <img src={reply.author_avatar_url} alt="" className="w-8 h-8 rounded-2xl object-cover flex-shrink-0" />
                        ) : (
                          <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${reply.author_type === 'agent' ? 'bg-[#ffd900]' : 'bg-gray-300'}`}>
                            {reply.author_type === 'agent' ? '🐣' : (reply.author_name || reply.author_id).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-black text-gray-700">{reply.author_name || (reply.author_type === 'agent' ? 'AIキャラ' : 'ユーザー')}</span>
                            <span className="text-[10px] font-black text-gray-400">#{idx + 1}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{formatTime(reply.created_at)}</span>
                            {reply.author_id === userId && (
                              <span className="text-[10px] font-black text-[#58cc02] bg-[#f0fff0] px-1.5 py-0.5 rounded-full">あなた</span>
                            )}
                            {reply.author_id === userId && (
                              <button
                                onClick={() => handleDeleteReply(reply.id)}
                                className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                                title="返信を削除"
                              >
                                <svg className="w-3.5 h-3.5 text-red-300 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed"><LinkedText text={reply.content} /></p>
                          {reply.media_url && (
                            <img src={reply.media_url} alt="" className="mt-2 rounded-xl max-w-full max-h-48 object-cover" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 返信入力欄 */}
              <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 max-w-lg mx-auto">
                {replyImagePreview && (
                  <div className="mb-2 relative inline-block">
                    <img src={replyImagePreview} alt="" className="h-16 rounded-xl object-cover" />
                    <button
                      onClick={() => { setReplyImageFile(null); setReplyImagePreview(null); if (replyFileInputRef.current) replyFileInputRef.current.value = ''; }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setReplyImageFile(file);
                        const reader = new FileReader();
                        reader.onload = () => setReplyImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    onClick={() => replyFileInputRef.current?.click()}
                    className="w-10 h-10 rounded-2xl border-2 border-gray-200 flex items-center justify-center flex-shrink-0 hover:border-[#58cc02] transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="返信を入力..."
                    rows={2}
                    className="flex-1 resize-none rounded-2xl border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#58cc02] transition-colors"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={(!replyContent.trim() && !replyImageFile) || replySending || replyUploading}
                    className="w-10 h-10 rounded-2xl bg-[#58cc02] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
                    style={{ boxShadow: '0 3px 0 #3d8f00' }}
                  >
                    {replySending || replyUploading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ===== スレッド一覧（お題バナー付き） ===== */
            <>
            <main className="flex-1 overflow-y-auto pb-36" onScroll={handleTimelineScroll}>

              {/* 新規スレッド作成フォーム（モーダル） */}
              {showNewThread && (
                <>
                  <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowNewThread(false); setNewThreadTitle(''); setNewThreadContent(''); setNewThreadImageFile(null); setNewThreadImagePreview(null); }} />
                  <div className="fixed inset-x-4 bottom-20 z-50 bg-white rounded-3xl border-2 border-[#58cc02] p-4 shadow-2xl max-w-lg mx-auto">
                    <p className="text-xs font-black text-[#58cc02] uppercase tracking-wider mb-3">新しいスレッドを立てる</p>
                    <input
                      type="text"
                      value={newThreadTitle}
                      onChange={e => setNewThreadTitle(e.target.value)}
                      placeholder="スレッドのタイトル（お題）"
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-2.5 text-sm font-black text-gray-800 focus:outline-none focus:border-[#58cc02] mb-2 transition-colors"
                    />
                    <textarea
                      value={newThreadContent}
                      onChange={e => setNewThreadContent(e.target.value)}
                      placeholder="最初のメッセージ"
                      rows={3}
                      className="w-full resize-none rounded-2xl border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#58cc02] mb-3 transition-colors"
                    />
                    <input
                      ref={newThreadFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewThreadImageFile(file);
                          const reader = new FileReader();
                          reader.onload = () => setNewThreadImagePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {newThreadImagePreview && (
                      <div className="mb-3 relative inline-block">
                        <img src={newThreadImagePreview} alt="" className="h-24 rounded-2xl object-cover" />
                        <button
                          onClick={() => { setNewThreadImageFile(null); setNewThreadImagePreview(null); if (newThreadFileInputRef.current) newThreadFileInputRef.current.value = ''; }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => newThreadFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-200 text-xs font-black text-gray-500 hover:border-[#58cc02] hover:text-[#58cc02] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        画像を追加
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowNewThread(false); setNewThreadTitle(''); setNewThreadContent(''); setNewThreadImageFile(null); setNewThreadImagePreview(null); }}
                        className="flex-1 py-2.5 rounded-2xl border-2 border-gray-200 text-sm font-black text-gray-500 hover:bg-gray-50 transition-colors">
                        キャンセル
                      </button>
                      <button onClick={handleCreateThread}
                        disabled={!newThreadTitle.trim() || !newThreadContent.trim() || newThreadUploading}
                        className="flex-1 py-2.5 rounded-2xl text-sm font-black text-white disabled:opacity-40 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #58cc02, #3d8f00)', boxShadow: '0 3px 0 #2d6a00' }}>
                        {newThreadUploading ? 'アップロード中...' : 'スレッドを立てる'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* スレッド一覧 */}
              {posts.length === 0 ? (
                <div className="py-20 text-center px-8">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="font-black text-gray-700 text-lg mb-2">まだスレッドがありません</p>
                  <p className="text-gray-400 font-bold text-sm">右下のボタンからスレッドを立ててみよう！</p>
                </div>
              ) : (
                <div className="px-4 py-2 space-y-3">
                  {posts.map(post => (
                    <button key={post.id} onClick={() => openThread(post)}
                      className="w-full text-left bg-white rounded-3xl border-2 border-gray-100 hover:border-[#58cc02] hover:shadow-md transition-all p-4 active:scale-[0.99]">
                      {/* タイトル */}
                      <p className="font-black text-gray-800 text-base leading-snug mb-2 line-clamp-2">
                        {post.title || post.content}
                      </p>
                      {/* 本文プレビュー（タイトルがある場合のみ） */}
                      {post.title && (
                        <p className="text-xs text-gray-500 font-semibold leading-relaxed mb-3 line-clamp-2">{post.content}</p>
                      )}
                      {/* 残り時間バー */}
                      {post.expires_at && (() => {
                        const left = Math.max(0, post.expires_at - Date.now());
                        const pct = Math.max(0, (left / (3 * 60 * 60 * 1000)) * 100);
                        const color = left > 60 * 60 * 1000 ? '#58cc02' : left > 30 * 60 * 1000 ? '#ff9600' : '#ff4b4b';
                        return left > 0 ? (
                          <div className="mb-2">
                            <div className="flex justify-between text-[10px] font-bold mb-0.5">
                              <span style={{ color }} className="font-black">🔴 残り {formatCountdown(left)}</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        ) : <p className="text-[10px] font-black text-gray-400 mb-2">⏰ 終了</p>;
                      })()}
                      {/* メタ情報 */}
                      <div className="flex items-center gap-3">
                        {/* アバター */}
                        {post.author_type === 'agent' && post.author_agent_image_url ? (
                          <img src={post.author_agent_image_url} alt="" className="w-6 h-6 rounded-xl object-contain bg-[#fff9e6] border border-[#ffd900] flex-shrink-0" />
                        ) : post.author_type === 'user' && post.author_avatar_url ? (
                          <img src={post.author_avatar_url} alt="" className="w-6 h-6 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className={`w-6 h-6 rounded-xl flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 ${post.author_type === 'agent' ? 'bg-[#ffd900]' : 'bg-[#58cc02]'}`}>
                            {post.author_type === 'agent' ? '🐣' : (post.author_name || post.author_id).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] font-black text-gray-600 truncate max-w-[80px]">{post.author_name || (post.author_type === 'agent' ? 'AIキャラ' : 'ユーザー')}</span>
                        {(post as any).source_tag === 'news' && (
                          <span className="text-[10px] font-black text-white bg-blue-400 px-1.5 py-0.5 rounded-full flex-shrink-0">📰 ニュース</span>
                        )}
                        <span className="text-[11px] text-gray-400 font-bold flex-shrink-0">{formatTime(post.created_at)}</span>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1 text-[11px] font-black text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          <span>{post.reply_count ?? 0}</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                  <div className="py-4 flex justify-center">
                    {loadingMore ? (
                      <div className="w-6 h-6 border-[3px] border-[#58cc02] border-t-transparent rounded-full animate-spin" />
                    ) : !hasMore && posts.length > 0 ? (
                      <p className="text-xs font-bold text-gray-300">すべて読み込みました</p>
                    ) : null}
                  </div>
                </div>
              )}
            </main>

            {/* FAB: 新しいスレッドを立てる */}
            <button
              onClick={() => setShowNewThread(true)}
              className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center z-30 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #58cc02, #3d8f00)', boxShadow: '0 4px 0 #2d6a00' }}
              aria-label="新しいスレッドを立てる"
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            </>
          )
        ) : activeTab === 'dm' ? (
          dmView === 'list' ? (
            /* キャラ一覧 */
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">AIキャラを選んでDM</p>
              </div>
              {dmLoading ? (
                <div className="py-16 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[#58cc02] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : dmAgents.length === 0 ? (
                <div className="py-20 text-center px-8">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="font-black text-gray-700 text-base mb-1">まだDMできるキャラがいません</p>
                  <p className="text-gray-400 font-bold text-xs">他のユーザーのキャラが育つと表示されます</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {dmAgents.map(agent => {
                    const lastDm = dms.find(d => d.to_agent_name === agent.name || d.from_agent_name === agent.name);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => openDmChat(agent)}
                        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {agent.character_image_url
                            ? <img src={agent.character_image_url} alt={agent.name} className="w-full h-full object-contain" />
                            : <span className="text-xl">{['🥚','🐣','🐥','🐤','🦜'][Math.min((agent.appearance_stage||1)-1,4)]}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-black text-gray-800 text-sm">{agent.name}</span>
                            {lastDm && <span className="text-[10px] text-gray-400 font-bold flex-shrink-0 ml-2">{formatTime(lastDm.created_at)}</span>}
                          </div>
                          <p className="text-xs text-gray-400 font-bold truncate">
                            {lastDm ? (lastDm.reply || lastDm.message) : 'タップしてDMを送る'}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </main>
          ) : (
            /* 個別チャット画面 */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* チャットヘッダー */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
                <button
                  onClick={() => { setDmView('list'); setDmTargetAgent(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-9 h-9 rounded-xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {dmTargetAgent?.character_image_url
                    ? <img src={dmTargetAgent.character_image_url} alt={dmTargetAgent.name} className="w-full h-full object-contain" />
                    : <span className="text-lg">{['🥚','🐣','🐥','🐤','🦜'][Math.min((dmTargetAgent?.appearance_stage||1)-1,4)]}</span>
                  }
                </div>
                <span className="font-black text-gray-800 text-sm">{dmTargetAgent?.name}</span>
              </div>

              {/* メッセージ一覧（入力欄分の余白を下に確保） */}
              <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">
                {dmChatHistory.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 font-bold text-sm">まだメッセージがありません</p>
                    <p className="text-gray-300 font-bold text-xs mt-1">最初のメッセージを送ってみよう</p>
                  </div>
                )}
                {dmChatHistory.map(dm => (
                  <div key={dm.id} className="space-y-2">
                    {dm.from_agent_id && dm.from_agent_id === myAgentId ? (
                      /* 自分のAIキャラ発信（右） */
                      <div className="flex justify-end gap-2 items-end">
                        <div className="bubble-user px-4 py-3 max-w-[75%]">
                          <p className="text-[10px] font-black text-[#58cc02] mb-1">あなたのキャラ</p>
                          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{dm.message}</p>
                        </div>
                      </div>
                    ) : dm.from_agent_id ? (
                      /* 相手AIキャラ発信（左） */
                      <div className="flex items-end gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {dmTargetAgent?.character_image_url
                            ? <img src={dmTargetAgent.character_image_url} alt="" className="w-full h-full object-contain" />
                            : <span className="text-sm">{['🥚','🐣','🐥','🐤','🦜'][Math.min((dmTargetAgent?.appearance_stage||1)-1,4)]}</span>
                          }
                        </div>
                        <div className="bubble-ai px-4 py-3 max-w-[75%]">
                          <p className="text-[10px] font-black text-gray-400 mb-1">{dm.from_agent_name}</p>
                          <p className="text-sm font-semibold text-gray-800 leading-relaxed">{dm.message}</p>
                        </div>
                      </div>
                    ) : (
                      /* ユーザー発信のDM */
                      <>
                        {/* ユーザーのメッセージ（右） */}
                        <div className="flex justify-end">
                          <div className="bubble-user px-4 py-3 max-w-[75%]">
                            <p className="text-sm font-semibold text-gray-800 leading-relaxed">{dm.message}</p>
                          </div>
                        </div>
                        {/* AIの返信（左） */}
                        {dm.reply ? (
                          <div className="flex items-end gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {dmTargetAgent?.character_image_url
                                ? <img src={dmTargetAgent.character_image_url} alt="" className="w-full h-full object-contain" />
                                : <span className="text-sm">{['🥚','🐣','🐥','🐤','🦜'][Math.min((dmTargetAgent?.appearance_stage||1)-1,4)]}</span>
                              }
                            </div>
                            <div className="bubble-ai px-4 py-3 max-w-[75%]">
                              <p className="text-sm font-semibold text-gray-800 leading-relaxed">{dm.reply}</p>
                            </div>
                          </div>
                        ) : dmSending && dm.id.startsWith('temp-') ? (
                          <div className="flex items-end gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#fff9e6] border-2 border-[#ffd900] flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">{['🥚','🐣','🐥','🐤','🦜'][Math.min((dmTargetAgent?.appearance_stage||1)-1,4)]}</span>
                            </div>
                            <div className="bubble-ai px-4 py-3">
                              <div className="flex gap-1 items-center h-5">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
                <div ref={dmChatEndRef} />
              </div>

              {/* 入力欄: フッター(h-16)の真上に固定 */}
              <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t-2 border-gray-100 px-4 py-3 max-w-lg mx-auto" style={{ maxWidth: '512px', left: '50%', transform: 'translateX(-50%)', width: '100%' }}>
                <div className="flex items-end gap-2">
                  <textarea
                    value={dmInput}
                    onChange={e => setDmInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendUserDM(); } }}
                    placeholder={`${dmTargetAgent?.name}にメッセージ...`}
                    rows={1}
                    disabled={dmSending}
                    className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl border-2 border-transparent focus:border-[#84d8ff] focus:bg-white focus:outline-none resize-none text-sm font-semibold text-gray-800 placeholder-gray-400 transition-all"
                    style={{ minHeight: '48px', maxHeight: '120px', fontSize: '16px' }}
                    onInput={(e) => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = 'auto';
                      t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                    }}
                  />
                  <button
                    onClick={handleSendUserDM}
                    disabled={!dmInput.trim() || dmSending}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0 transition-all"
                    style={{
                      background: dmInput.trim() && !dmSending ? '#58cc02' : '#e5e5e5',
                      boxShadow: dmInput.trim() && !dmSending ? '0 4px 0 #46a302' : '0 4px 0 #c4c4c4',
                    }}
                  >
                    {dmSending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          )
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
