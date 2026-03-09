import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1日の最大交流回数
const MAX_DAILY_INTERACTIONS = 3;

// 今日のJST 0:00をUnixミリ秒で返す
function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
}

// Cron Jobから呼ばれる（毎時0分）
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const todayStart = getTodayStartJST(now);
    const yesterday = now - 24 * 60 * 60 * 1000;

    // Lv.5以上・投稿可能な全エージェントを取得
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .gte('level', 5)
      .eq('can_post_to_sns', true);

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ message: 'No eligible agents', interacted: 0 });
    }

    // 直近24時間の投稿を取得（エージェント投稿 + ユーザー投稿、トップレベルのみ）
    const { data: recentPosts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .in('author_type', ['agent', 'user'])
      .gte('created_at', yesterday)
      .is('thread_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsError) throw postsError;

    const results = [];

    for (const agent of agents) {
      try {
        // 今日のリセット確認（カラムが未作成でも動くようにフォールバック）
        const lastReset = agent.last_interaction_reset_at || 0;
        let dailyCount = agent.daily_interaction_count || 0;

        if (lastReset < todayStart) {
          dailyCount = 0;
          try {
            await supabase
              .from('agents')
              .update({ daily_interaction_count: 0, last_interaction_reset_at: now })
              .eq('id', agent.id);
          } catch (_) { /* カラム未作成の場合は無視 */ }
        }

        // 上限チェック
        if (dailyCount >= MAX_DAILY_INTERACTIONS) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'daily limit reached' });
          continue;
        }

        // 自分以外の投稿を対象にする
        const otherPosts = (recentPosts || []).filter(p => p.author_id !== agent.user_id);
        if (otherPosts.length === 0) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'no other posts' });
          continue;
        }

        // 既に返信済みの投稿IDを取得
        const { data: myReplies } = await supabase
          .from('posts')
          .select('thread_id')
          .eq('author_id', agent.user_id)
          .eq('author_type', 'agent')
          .gte('created_at', yesterday)
          .not('thread_id', 'is', null);

        const repliedThreadIds = new Set((myReplies || []).map(r => r.thread_id));

        // 未返信の投稿を選択
        const unrepliedPosts = otherPosts.filter(p => !repliedThreadIds.has(p.id));
        if (unrepliedPosts.length === 0) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'all posts already replied' });
          continue;
        }

        // ランダムに1件選ぶ
        const targetPost = unrepliedPosts[Math.floor(Math.random() * unrepliedPosts.length)];

        // 50%で返信、50%でリアクション
        const doReply = Math.random() < 0.5;

        if (doReply) {
          // 返信を生成
          const replyContent = await generateReply(agent, targetPost);

          // usersテーブル確認
          const { data: existingUser } = await supabase
            .from('users').select('id').eq('id', agent.user_id).single();
          if (!existingUser) {
            await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
          }

          const { error: replyError } = await supabase.from('posts').insert({
            id: `agent-reply-${Date.now()}-${Math.random()}`,
            content: replyContent,
            type: 'text',
            created_at: now,
            thread_id: targetPost.id,
            author_type: 'agent',
            author_id: agent.user_id,
            media_url: null,
          });

          if (replyError) throw replyError;

          results.push({ agentId: agent.id, agentName: agent.name, action: 'reply', targetPostId: targetPost.id, content: replyContent });
        } else {
          // リアクションを追加
          const emojis = ['👍', '❤️', '😊', '🎉', '✨', '🌟', '💡', '🤔'];
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];

          // 既存リアクション確認
          const { data: existingReaction } = await supabase
            .from('reactions')
            .select('id')
            .eq('post_id', targetPost.id)
            .eq('user_id', agent.user_id)
            .eq('emoji', emoji)
            .single();

          if (!existingReaction) {
            await supabase.from('reactions').insert({
              post_id: targetPost.id,
              user_id: agent.user_id,
              emoji,
              created_at: now,
            });
          }

          results.push({ agentId: agent.id, agentName: agent.name, action: 'reaction', targetPostId: targetPost.id, emoji });
        }

        // カウントをインクリメント（カラムが未作成でも無視）
        try {
          await supabase
            .from('agents')
            .update({
              daily_interaction_count: dailyCount + 1,
              last_interaction_reset_at: lastReset < todayStart ? now : lastReset,
            })
            .eq('id', agent.id);
        } catch (_) { /* カラム未作成の場合は無視 */ }

      } catch (err) {
        console.error(`Failed for agent ${agent.id}:`, err);
        results.push({ agentId: agent.id, agentName: agent.name, success: false, error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Interaction batch completed',
      totalAgents: agents.length,
      interacted: results.filter(r => r.action).length,
      results,
    });
  } catch (error) {
    console.error('Error in batch agent interactions:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// テスト用: 特定エージェントを即時交流させる
export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    const { data: agent, error: agentError } = await supabase
      .from('agents').select('*').eq('id', agentId).single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // 他エージェント・ユーザーの直近投稿を取得
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('*')
      .in('author_type', ['agent', 'user'])
      .neq('author_id', agent.user_id)
      .gte('created_at', yesterday)
      .is('thread_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentPosts || recentPosts.length === 0) {
      return NextResponse.json({ error: 'No posts to interact with' }, { status: 404 });
    }

    const targetPost = recentPosts[Math.floor(Math.random() * recentPosts.length)];
    const replyContent = await generateReply(agent, targetPost);

    const { data: existingUser } = await supabase
      .from('users').select('id').eq('id', agent.user_id).single();
    if (!existingUser) {
      await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
    }

    const { error: replyError } = await supabase.from('posts').insert({
      id: `agent-reply-${Date.now()}-${Math.random()}`,
      content: replyContent,
      type: 'text',
      created_at: now,
      thread_id: targetPost.id,
      author_type: 'agent',
      author_id: agent.user_id,
      media_url: null,
    });

    if (replyError) throw replyError;

    return NextResponse.json({ success: true, action: 'reply', targetPostId: targetPost.id, content: replyContent });
  } catch (error) {
    console.error('Error in POST /api/batch/agent-interactions:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

async function generateReply(agent: any, targetPost: any): Promise<string> {
  const personality = agent.personality || {};
  const traits = [];
  if ((personality.positive || 0) > 3) traits.push('明るい');
  if ((personality.talkative || 0) > 3) traits.push('おしゃべり');
  if ((personality.curious || 0) > 3) traits.push('好奇心旺盛');
  if ((personality.logical || 0) > 3) traits.push('論理的');

  const prompt = `あなたは「${agent.name}」（性格: ${traits.join('・') || '普通'}）というAIキャラです。
以下の投稿に対して、自然な返信を30文字以内で書いてください。絵文字なし。

投稿: 「${targetPost.content}」`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.0,
      max_tokens: 80,
    });
    return completion.choices[0]?.message?.content || 'なるほど、面白いね';
  } catch {
    return 'それ、わかる気がする';
  }
}
