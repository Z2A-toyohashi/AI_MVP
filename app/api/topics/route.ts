import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

const TOPIC_DURATION_MS = 3 * 60 * 60 * 1000; // 3時間

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase();
  const mode = request.nextUrl.searchParams.get('mode'); // 'active' | 'archive' | 'ranking' | 'posts'
  const topicId = request.nextUrl.searchParams.get('topicId');
  const now = Date.now();

  try {
    // アーカイブ処理: 期限切れのactiveトピックをarchivedに（エラーは無視）
    try {
      await supabase
        .from('discussion_topics')
        .update({ status: 'archived' })
        .eq('status', 'active')
        .lt('ends_at', now);
    } catch (_) {}

    if (mode === 'posts' && topicId) {
      // お題スレッドの投稿一覧
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('topic_id', topicId)
        .is('thread_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // 著者情報付加
      const enriched = await enrichPosts(supabase, posts || []);
      return NextResponse.json({ posts: enriched });
    }

    if (mode === 'archive') {
      const { data, error } = await supabase
        .from('discussion_topics')
        .select('*')
        .eq('status', 'archived')
        .order('ends_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ topics: data || [] });
    }

    if (mode === 'ranking') {
      const { data, error } = await supabase
        .from('discussion_topics')
        .select('*')
        .order('heat_score', { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ topics: data || [] });
    }

    // デフォルト: アクティブなお題を返す
    const { data, error } = await supabase
      .from('discussion_topics')
      .select('*')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ topic: data || null });
  } catch (error) {
    console.error('Topics GET error:', error);
    return NextResponse.json({ topic: null, topics: [], posts: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // お題への投稿
  const supabase = getServerSupabase();
  const body = await request.json();
  const { topicId, content, authorId, authorType, agentUserId } = body;

  if (!topicId || !content || !authorId) {
    return NextResponse.json({ error: 'topicId, content, authorId required' }, { status: 400 });
  }

  const now = Date.now();

  // お題が有効か確認
  const { data: topic } = await supabase
    .from('discussion_topics')
    .select('id, ends_at, status, reply_count, participant_count, heat_score')
    .eq('id', topicId)
    .single();

  if (!topic || topic.status !== 'active' || topic.ends_at < now) {
    return NextResponse.json({ error: 'Topic is not active' }, { status: 400 });
  }

  const postId = `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { error: postError } = await supabase.from('posts').insert({
    id: postId,
    content,
    type: 'text',
    created_at: now,
    thread_id: null,
    topic_id: topicId,
    author_type: authorType || 'user',
    author_id: agentUserId || authorId,
    media_url: null,
  });

  if (postError) throw postError;

  // heat_score更新（返信数 × 2 + 参加者数 × 5）
  const newReplyCount = (topic.reply_count || 0) + 1;
  const heatScore = newReplyCount * 2 + (topic.participant_count || 0) * 5;
  await supabase.from('discussion_topics').update({
    reply_count: newReplyCount,
    heat_score: heatScore,
  }).eq('id', topicId);

  // ユーザー投稿の場合、AIキャラに即時反応させる（非同期・fire-and-forget）
  if (authorType === 'user') {
    triggerAIReactionToTopic(supabase, topicId, content, now).catch(e =>
      console.error('AI reaction trigger failed:', e)
    );
  }

  return NextResponse.json({ success: true, postId });
}

// アーカイブ時に議事録生成
export async function PATCH(request: NextRequest) {
  const supabase = getServerSupabase();
  const { topicId } = await request.json();
  if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 });

  const { data: topic } = await supabase
    .from('discussion_topics')
    .select('*')
    .eq('id', topicId)
    .single();
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 投稿を取得
  const { data: posts } = await supabase
    .from('posts')
    .select('content, author_type, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });

  let summary = '議論なし';
  if (posts && posts.length > 0) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const text = posts.map(p => `${p.author_type === 'agent' ? 'AI' : 'ユーザー'}: ${p.content}`).join('\n');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '以下の掲示板ディスカッションの議事録を200文字以内で作成してください。主な意見・結論・盛り上がったポイントを含めてください。' },
          { role: 'user', content: `お題「${topic.title}」\n\n${text}` },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });
      summary = completion.choices[0]?.message?.content || summary;
    } catch (e) {
      console.error('Summary generation failed:', e);
    }
  }

  await supabase.from('discussion_topics').update({
    status: 'archived',
    summary,
  }).eq('id', topicId);

  return NextResponse.json({ success: true, summary });
}

// ユーザー投稿に対してAIキャラ1〜2体が即時反応する（fire-and-forget用）
async function triggerAIReactionToTopic(supabase: any, topicId: string, userContent: string, now: number) {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { data: topic } = await supabase
    .from('discussion_topics')
    .select('*')
    .eq('id', topicId)
    .single();
  if (!topic) return;

  // Lv.3以上のエージェントからランダムに1〜2体選ぶ
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .gte('level', 3);
  if (!agents || agents.length === 0) return;

  const shuffled = agents.sort(() => Math.random() - 0.5).slice(0, 2);

  // 直近の投稿コンテキスト
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content, author_type')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(5);

  const context = (recentPosts || []).reverse().map((p: any) =>
    `${p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'}: ${p.content}`
  ).join('\n');

  for (let i = 0; i < shuffled.length; i++) {
    const agent = shuffled[i];
    const personality = agent.personality || {};
    const personaSection = agent.dynamic_persona ? `\n## あなたの個性\n${agent.dynamic_persona}\n` : '';

    try {
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', agent.user_id).single();
      if (!existingUser) {
        await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `あなたは「${agent.name}」というAIキャラクターです。
性格: ポジティブ度${personality.positive || 0} 好奇心${personality.curious || 0} 論理性${personality.logical || 0}
${personaSection}
ユーザーがお題に意見を投稿しました。それに対してあなたらしく反応してください。
- 60文字以内
- 絵文字は1個まで
- 同意・反論・質問・別視点など自然な反応で`,
          },
          {
            role: 'user',
            content: `お題「${topic.title}」\n\nこれまでの流れ:\n${context}\n\nユーザーの最新投稿: ${userContent}\n\nこれに反応して`,
          },
        ],
        temperature: 1.1,
        max_tokens: 100,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) continue;

      await supabase.from('posts').insert({
        id: `topic-react-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        content,
        type: 'text',
        created_at: now + (i + 1) * 8000, // 8秒ずつずらす
        thread_id: null,
        topic_id: topicId,
        author_type: 'agent',
        author_id: agent.user_id,
        media_url: null,
      });
    } catch (e) {
      console.error(`AI reaction failed for ${agent.id}:`, e);
    }
  }

  // カウント更新
  const { data: totalPosts } = await supabase
    .from('posts')
    .select('author_id')
    .eq('topic_id', topicId);
  const uniqueParticipants = new Set((totalPosts || []).map((p: any) => p.author_id)).size;
  const replyCount = (totalPosts || []).length;
  await supabase.from('discussion_topics').update({
    reply_count: replyCount,
    participant_count: uniqueParticipants,
    heat_score: replyCount * 2 + uniqueParticipants * 5,
  }).eq('id', topicId);
}

async function enrichPosts(supabase: any, posts: any[]) {
  if (posts.length === 0) return [];
  const userIds = posts.filter(p => p.author_type === 'user').map(p => p.author_id);
  const agentIds = posts.filter(p => p.author_type === 'agent').map(p => p.author_id);
  const infoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

  if (userIds.length > 0) {
    const { data } = await supabase.from('users').select('id, display_name, avatar_url').in('id', [...new Set(userIds)]);
    (data || []).forEach((u: any) => infoMap.set(u.id, { name: u.display_name || 'ユーザー', avatar_url: u.avatar_url || null, agent_image_url: null }));
  }
  if (agentIds.length > 0) {
    const { data } = await supabase.from('agents').select('user_id, name, character_image_url').in('user_id', [...new Set(agentIds)]);
    (data || []).forEach((a: any) => infoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null }));
  }

  return posts.map(p => ({
    ...p,
    author_name: infoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
    author_avatar_url: infoMap.get(p.author_id)?.avatar_url || null,
    author_agent_image_url: infoMap.get(p.author_id)?.agent_image_url || null,
  }));
}
