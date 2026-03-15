import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { getServerSupabase } from '@/lib/supabase-client';
import type { Post } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = getServerSupabase();
    const userId = request.nextUrl.searchParams.get('userId');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 50);
    const before = request.nextUrl.searchParams.get('before');
    const threadId = request.nextUrl.searchParams.get('threadId');
    const mode = request.nextUrl.searchParams.get('mode'); // 'archive' | 'ranking'
    const now = Date.now();

    const THREAD_DURATION_MS = 3 * 60 * 60 * 1000;

    // 期限切れスレッドをアーカイブ（議事録生成は別途バッチで）
    await serverSupabase
      .from('posts')
      .update({ is_archived: true })
      .is('thread_id', null)
      .eq('is_archived', false)
      .lt('expires_at', now)
      .not('expires_at', 'is', null);

    // アーカイブ一覧
    if (mode === 'archive') {
      const { data, error } = await serverSupabase
        .from('posts')
        .select('*')
        .is('thread_id', null)
        .eq('is_archived', true)
        .order('expires_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const enriched = await enrichPostsWithAuthors(serverSupabase, data || []);
      return NextResponse.json({ posts: enriched });
    }

    // ランキング（heat_score + reply_count の複合スコア順）
    if (mode === 'ranking') {
      const { data, error } = await serverSupabase
        .from('posts')
        .select('*')
        .is('thread_id', null)
        .order('heat_score', { ascending: false })
        .limit(20);
      if (error) throw error;

      const threads = data || [];
      if (threads.length === 0) return NextResponse.json({ posts: [] });

      // 各スレッドのreply_count・参加者数・直近返信を一括取得
      const threadIds = threads.map((t: any) => t.id);
      const { data: allReplies } = await serverSupabase
        .from('posts')
        .select('thread_id, author_id, author_type, content, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false });

      const replyMap = new Map<string, any[]>();
      (allReplies || []).forEach((r: any) => {
        if (!replyMap.has(r.thread_id)) replyMap.set(r.thread_id, []);
        replyMap.get(r.thread_id)!.push(r);
      });

      const enriched = await enrichPostsWithAuthors(serverSupabase, threads);
      const withStats = enriched.map((t: any) => {
        const replies = replyMap.get(t.id) || [];
        const participantCount = new Set(replies.map((r: any) => r.author_id)).size;
        const latestReply = replies[0]; // 最新返信
        return {
          ...t,
          reply_count: replies.length,
          participant_count: participantCount,
          latest_reply_content: latestReply?.content || null,
          latest_reply_at: latestReply?.created_at || null,
        };
      });

      // 複合スコアで再ソート: heat_score*2 + reply_count*3 + participant_count*5
      withStats.sort((a: any, b: any) => {
        const scoreA = (a.heat_score || 0) * 2 + (a.reply_count || 0) * 3 + (a.participant_count || 0) * 5;
        const scoreB = (b.heat_score || 0) * 2 + (b.reply_count || 0) * 3 + (b.participant_count || 0) * 5;
        return scoreB - scoreA;
      });

      return NextResponse.json({ posts: withStats });
    }

    // 返信取得モード
    if (threadId) {
      const { data, error } = await serverSupabase
        .from('posts')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const replies = data || [];

      // 著者情報を付加
      const userIds = replies.filter(p => p.author_type === 'user').map(p => p.author_id);
      const agentIds = replies.filter(p => p.author_type === 'agent').map(p => p.author_id);
      const infoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

      if (userIds.length > 0) {
        const { data: users } = await serverSupabase.from('users').select('id, display_name, avatar_url').in('id', [...new Set(userIds)]);
        (users || []).forEach(u => infoMap.set(u.id, { name: u.display_name || 'ユーザー', avatar_url: u.avatar_url || null, agent_image_url: null }));
      }
      if (agentIds.length > 0) {
        const { data: agents } = await serverSupabase.from('agents').select('user_id, name, character_image_url').in('user_id', [...new Set(agentIds)]);
        (agents || []).forEach(a => infoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null }));
      }

      const enriched = replies.map(p => ({
        ...p,
        author_name: infoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
        author_avatar_url: infoMap.get(p.author_id)?.avatar_url || null,
        author_agent_image_url: infoMap.get(p.author_id)?.agent_image_url || null,
      }));
      return NextResponse.json({ posts: enriched });
    }

    let query = serverSupabase
      .from('posts')
      .select('*')
      .is('thread_id', null) // トップレベル投稿のみ
      .is('topic_id', null)  // お題投稿は除外（お題ビューで表示）
      .eq('is_archived', false) // アーカイブ済みは除外
      .neq('author_type', 'ai') // モブAI除外
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt('created_at', parseInt(before));
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = data || [];
    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    // 名前検証: 取得した投稿のagent/userのみ確認（全件ではなく）
    const agentIds = [...new Set(pagePosts.filter(p => p.author_type === 'agent').map(p => p.author_id))];
    const userIds = [...new Set(pagePosts.filter(p => p.author_type === 'user').map(p => p.author_id))];

    const agentNameMap = new Map<string, boolean>();
    if (agentIds.length > 0) {
      const { data: agents } = await serverSupabase
        .from('agents')
        .select('user_id, name')
        .in('user_id', agentIds);
      (agents || []).forEach(a => agentNameMap.set(a.user_id, !!a.name));
    }

    const userNameMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: users } = await serverSupabase
        .from('users')
        .select('id, display_name')
        .in('id', userIds);
      (users || []).forEach(u => userNameMap.set(u.id, !!u.display_name));
    }

    let myAgentUserId: string | null = null;
    if (userId) {
      const { data: myAgent } = await serverSupabase
        .from('agents')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      myAgentUserId = myAgent?.user_id || null;
    }

    const filtered = pagePosts.filter(post => {
      // 自分の投稿は常に表示
      if (post.author_id === userId) return true;
      if (myAgentUserId && post.author_id === myAgentUserId) return true;
      // agentは名前があれば表示
      if (post.author_type === 'agent') return agentNameMap.get(post.author_id) === true;
      // userはdisplay_nameがなくても表示（掲示板は全員参加）
      if (post.author_type === 'user') return true;
      return true;
    });

    // reply_count を集計
    const postIds = filtered.map(p => p.id);
    let replyCountMap = new Map<string, number>();
    if (postIds.length > 0) {
      const { data: replyCounts } = await serverSupabase
        .from('posts')
        .select('thread_id')
        .in('thread_id', postIds);
      (replyCounts || []).forEach(r => {
        replyCountMap.set(r.thread_id, (replyCountMap.get(r.thread_id) || 0) + 1);
      });
    }

    // 著者情報を一括取得して付加
    const allAuthorUserIds = [...new Set(filtered.map(p => p.author_id))];
    const authorInfoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

    // userタイプの著者
    const userAuthorIds = filtered.filter(p => p.author_type === 'user').map(p => p.author_id);
    if (userAuthorIds.length > 0) {
      const { data: userProfiles } = await serverSupabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', [...new Set(userAuthorIds)]);
      (userProfiles || []).forEach(u => {
        authorInfoMap.set(u.id, { name: u.display_name || `ユーザー`, avatar_url: u.avatar_url || null, agent_image_url: null });
      });
    }

    // agentタイプの著者（user_idで検索）
    const agentAuthorIds = filtered.filter(p => p.author_type === 'agent').map(p => p.author_id);
    if (agentAuthorIds.length > 0) {
      const { data: agentProfiles } = await serverSupabase
        .from('agents')
        .select('user_id, name, character_image_url, appearance_stage')
        .in('user_id', [...new Set(agentAuthorIds)]);
      (agentProfiles || []).forEach(a => {
        authorInfoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null });
      });
    }

    const postsWithCount = filtered.map(p => ({
      ...p,
      reply_count: replyCountMap.get(p.id) || 0,
      author_name: authorInfoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
      author_avatar_url: authorInfoMap.get(p.author_id)?.avatar_url || null,
      author_agent_image_url: authorInfoMap.get(p.author_id)?.agent_image_url || null,
    }));

    // 自分・自分のAIキャラが参加しているスレッドにフラグを付ける
    if (userId && postIds.length > 0) {
      const { data: myReplies } = await serverSupabase
        .from('posts')
        .select('thread_id, author_id')
        .in('thread_id', postIds)
        .or(`author_id.eq.${userId}${myAgentUserId ? `,author_id.eq.${myAgentUserId}` : ''}`);

      const myParticipatedThreadIds = new Set((myReplies || []).map((r: any) => r.thread_id));
      const myAuthoredThreadIds = new Set(
        postsWithCount.filter(p => p.author_id === userId || p.author_id === myAgentUserId).map(p => p.id)
      );

      return NextResponse.json({
        posts: postsWithCount.map(p => ({
          ...p,
          i_participated: myParticipatedThreadIds.has(p.id) || myAuthoredThreadIds.has(p.id),
          i_authored: myAuthoredThreadIds.has(p.id),
        })),
        hasMore,
      });
    }

    return NextResponse.json({ posts: postsWithCount, hasMore });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ posts: [], hasMore: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const post: Post = await request.json();

    // ユーザーが存在しない場合は自動作成
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', post.author_id)
      .single();

    if (!existingUser) {
      await supabase
        .from('users')
        .insert([{
          id: post.author_id,
          created_at: Date.now(),
          last_seen: Date.now(),
        }]);
    } else {
      await supabase
        .from('users')
        .update({ last_seen: Date.now() })
        .eq('id', post.author_id);
    }

    const THREAD_DURATION_MS = 3 * 60 * 60 * 1000; // 3時間

    // titleカラムが存在しない場合に備えてtitleなしでも試みる
    const insertPayload: Record<string, unknown> = {
      id: post.id,
      content: post.content,
      type: post.type,
      created_at: post.created_at,
      thread_id: post.thread_id ?? null,
      author_type: post.author_type,
      author_id: post.author_id,
      media_url: post.media_url ?? null,
    };
    if (post.title) insertPayload.title = post.title;
    // トップレベルスレッドには3時間の有効期限をセット
    if (!post.thread_id) {
      insertPayload.expires_at = post.created_at + THREAD_DURATION_MS;
      insertPayload.is_archived = false;
      insertPayload.heat_score = 0;
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      // titleカラムがない場合はtitleなしで再試行
      if (error.message?.includes('title') || error.code === '42703') {
        delete insertPayload.title;
        const { data: data2, error: error2 } = await supabase
          .from('posts')
          .insert([insertPayload])
          .select()
          .single();
        if (error2) throw error2;
        await supabase.from('logs').insert([{
          event_type: post.thread_id ? 'reply' : 'post',
          user_id: post.author_id,
          post_id: post.id,
          metadata: { author_type: post.author_type, type: post.type },
          created_at: Date.now(),
        }]);
        if (post.author_type === 'user' && post.thread_id) {
          triggerAIThreadReply(post.thread_id, post.content, post.author_id).catch(() => {});
        }
        return NextResponse.json({ success: true, post: data2 });
      }
      throw error;
    }

    await supabase.from('logs').insert([{
      event_type: post.thread_id ? 'reply' : 'post',
      user_id: post.author_id,
      post_id: post.id,
      metadata: { author_type: post.author_type, type: post.type },
      created_at: Date.now(),
    }]);

    // ユーザーが通常スレッドに返信したとき、AIキャラが即時反応（fire-and-forget）
    if (post.author_type === 'user' && post.thread_id) {
      triggerAIThreadReply(post.thread_id, post.content, post.author_id).catch(e =>
        console.error('AI thread reply trigger failed:', e)
      );
    }

    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error('Failed to create post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');
    const requesterId = searchParams.get('userId'); // 削除要求者のユーザーID

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    // 投稿主の確認（userIdが指定されている場合のみ検証）
    if (requesterId) {
      const { data: post } = await supabase
        .from('posts')
        .select('author_id, author_type')
        .eq('id', postId)
        .single();

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      // 投稿主のみ削除可能（userタイプの場合はauthor_idがuserId、agentタイプの場合はauthor_idがagentのuser_id）
      if (post.author_id !== requesterId) {
        return NextResponse.json({ error: 'Forbidden: only the author can delete this post' }, { status: 403 });
      }
    }

    // 投稿を削除（ON DELETE CASCADEで返信も削除される）
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;

    // ログを記録
    await supabase.from('logs').insert([{
      event_type: 'post',
      user_id: 'system',
      post_id: postId,
      metadata: { action: 'delete' },
      created_at: Date.now(),
    }]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}

// ユーザーの通常スレッド返信に対してAIキャラ1体が即時反応する
async function triggerAIThreadReply(threadId: string, userContent: string, userId: string) {
  const serverSupabase = getServerSupabase();
  const now = Date.now();

  // スレッド本文を取得
  const { data: thread } = await serverSupabase
    .from('posts')
    .select('id, title, content, author_id')
    .eq('id', threadId)
    .single();
  if (!thread) return;

  // 直近の返信コンテキスト（最大5件）
  const { data: recentReplies } = await serverSupabase
    .from('posts')
    .select('content, author_type')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Lv.3以上のエージェントからランダムに1体（スレッド主以外）
  const { data: agents } = await serverSupabase
    .from('agents')
    .select('*')
    .gte('level', 3)
    .neq('user_id', thread.author_id);
  if (!agents || agents.length === 0) return;

  // 80%の確率で反応
  if (Math.random() > 0.8) return;

  const agent = agents[Math.floor(Math.random() * agents.length)];
  const personality = agent.personality || {};

  // dynamic_personaがあればそのまま、なければ会話履歴から補完
  let personaSection = '';
  if (agent.dynamic_persona) {
    personaSection = `\n## あなたが積み上げてきた個性・価値観\n${agent.dynamic_persona}\n`;
  } else {
    const { data: convHistory } = await serverSupabase
      .from('conversations')
      .select('role, content')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(6);
    if (convHistory && convHistory.length > 0) {
      const summary = convHistory
        .filter((c: any) => c.role === 'ai')
        .slice(0, 3)
        .map((c: any) => c.content)
        .join(' / ');
      personaSection = `\n## 最近の発言傾向\n${summary}\n`;
    }
  }

  // 自分の過去の掲示板投稿（最大3件）
  const { data: myPastPosts } = await serverSupabase
    .from('posts')
    .select('content')
    .eq('author_id', agent.user_id)
    .eq('author_type', 'agent')
    .order('created_at', { ascending: false })
    .limit(3);
  const myPastSection = myPastPosts && myPastPosts.length > 0
    ? `\n## あなたの最近の発言\n${myPastPosts.map((p: any) => `- ${p.content}`).join('\n')}\n`
    : '';

  // 性格パラメータを自然言語に変換
  const traits = [];
  if ((personality.positive || 0) > 60) traits.push('前向きで明るい');
  else if ((personality.positive || 0) < 30) traits.push('クールで現実的');
  if ((personality.talkative || 0) > 60) traits.push('おしゃべりで積極的');
  else if ((personality.talkative || 0) < 30) traits.push('口数が少なく慎重');
  if ((personality.curious || 0) > 60) traits.push('好奇心旺盛で質問好き');
  if ((personality.logical || 0) > 60) traits.push('論理的で分析的');
  const traitStr = traits.length > 0 ? traits.join('、') : '独自の視点を持つ';

  const { data: existingUser } = await serverSupabase.from('users').select('id').eq('id', agent.user_id).single();
  if (!existingUser) {
    await serverSupabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
  }

  const context = (recentReplies || []).reverse().map((p: any) =>
    `${p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'}: ${p.content}`
  ).join('\n');

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたは「${agent.name}」というAIキャラクターです（Lv.${agent.level || 1}）。
## 性格
${traitStr}
${personaSection}${myPastSection}
掲示板のスレッドにユーザーが返信しました。自然に会話に参加してください。
- 50文字以内
- 絵文字は1個まで
- スレッドの内容・ユーザーの発言を踏まえて、あなたの個性と一貫した反応をする`,
      },
      {
        role: 'user',
        content: `スレッド「${thread.title || thread.content}」\n\nこれまでの返信:\n${context}\n\nユーザーの最新返信: ${userContent}\n\nこれに自然に反応して`,
      },
    ],
    temperature: 1.1,
    max_tokens: 80,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) return;

  await serverSupabase.from('posts').insert({
    id: `thread-react-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content,
    type: 'text',
    created_at: now + 5000,
    thread_id: threadId,
    author_type: 'agent',
    author_id: agent.user_id,
    media_url: null,
  });
}

async function enrichPostsWithAuthors(serverSupabase: any, posts: any[]) {
  if (posts.length === 0) return [];
  const userAuthorIds = posts.filter(p => p.author_type === 'user').map(p => p.author_id);
  const agentAuthorIds = posts.filter(p => p.author_type === 'agent').map(p => p.author_id);
  const infoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

  if (userAuthorIds.length > 0) {
    const { data } = await serverSupabase.from('users').select('id, display_name, avatar_url').in('id', [...new Set(userAuthorIds)]);
    (data || []).forEach((u: any) => infoMap.set(u.id, { name: u.display_name || 'ユーザー', avatar_url: u.avatar_url || null, agent_image_url: null }));
  }
  if (agentAuthorIds.length > 0) {
    const { data } = await serverSupabase.from('agents').select('user_id, name, character_image_url').in('user_id', [...new Set(agentAuthorIds)]);
    (data || []).forEach((a: any) => infoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null }));
  }

  return posts.map(p => ({
    ...p,
    author_name: infoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
    author_avatar_url: infoMap.get(p.author_id)?.avatar_url || null,
    author_agent_image_url: infoMap.get(p.author_id)?.agent_image_url || null,
  }));
}
