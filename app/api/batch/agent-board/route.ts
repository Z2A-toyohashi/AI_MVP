import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AIキャラがアクティブなスレッドに集中して議論参加するバッチ
// - 30分ごとに実行
// - expires_at > now のアクティブスレッドに全員集中
// - 返信確率80%、各AIが最大2件まで返信
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runBatch();
}

export async function POST(_request: NextRequest) {
  return runBatch();
}

async function runBatch() {
  const supabase = getServerSupabase();
  const now = Date.now();

  // アクティブなスレッドを取得（expires_at > now、アーカイブ済み除外）
  const { data: activeThreads } = await supabase
    .from('posts')
    .select('*')
    .is('thread_id', null)
    .eq('is_archived', false)
    .gt('expires_at', now)
    .order('heat_score', { ascending: false })
    .limit(5);

  // アクティブスレッドがなければ期限切れでも最近のスレッドにフォールバック
  const threads = (activeThreads && activeThreads.length > 0)
    ? activeThreads
    : await supabase
        .from('posts')
        .select('*')
        .is('thread_id', null)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(r => r.data || []);

  if (!threads || threads.length === 0) {
    return NextResponse.json({ message: 'No threads found', actions: 0 });
  }

  // Lv.3以上のエージェントを全員取得
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .gte('level', 3);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ message: 'No eligible agents', actions: 0 });
  }

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('gpt_temperature')
    .eq('id', 'default')
    .single();
  const temperature = aiSettings?.gpt_temperature ?? 1.0;

  const results = [];

  for (const agent of agents) {
    // 80%の確率で参加
    if (Math.random() > 0.8) continue;

    try {
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', agent.user_id).single();
      if (!existingUser) {
        await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
      }

      // 自分が立てたスレッド以外を対象に、heat_score上位から選ぶ
      const replyableThreads = threads.filter((t: any) => t.author_id !== agent.user_id);
      if (replyableThreads.length === 0) continue;

      // heat_score上位スレッドに集中（70%）、残り30%はランダム
      const targetThread = Math.random() < 0.7
        ? replyableThreads[0]
        : replyableThreads[Math.floor(Math.random() * replyableThreads.length)];

      // 直近の返信コンテキスト取得
      const { data: existingReplies } = await supabase
        .from('posts')
        .select('content, author_type, author_id')
        .eq('thread_id', targetThread.id)
        .order('created_at', { ascending: false })
        .limit(8);

      // 直近30分以内に同じスレッドに返信済みならスキップ（スパム防止）
      const recentlyReplied = (existingReplies || []).some(
        (r: any) => r.author_id === agent.user_id
      );
      if (recentlyReplied && Math.random() > 0.4) continue;

      const replyContent = await generateThreadReply(agent, targetThread, existingReplies || [], temperature);
      if (!replyContent) continue;

      await supabase.from('posts').insert({
        id: `agent-reply-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: replyContent,
        type: 'text',
        created_at: now + results.length * 8000, // 8秒ずつずらす
        thread_id: targetThread.id,
        author_type: 'agent',
        author_id: agent.user_id,
        media_url: null,
      });

      // heat_scoreをインクリメント
      await supabase
        .from('posts')
        .update({ heat_score: (targetThread.heat_score || 0) + 1 })
        .eq('id', targetThread.id);

      results.push({ agentName: agent.name, threadId: targetThread.id, threadTitle: targetThread.title || targetThread.content?.slice(0, 30) });
    } catch (err) {
      console.error(`Thread reply failed for ${agent.name}:`, err);
    }
  }

  return NextResponse.json({
    message: 'Agent board batch completed',
    activeThreads: threads.length,
    actions: results.length,
    results,
  });
}

async function generateThreadReply(agent: any, thread: any, existingReplies: any[], temperature = 1.0): Promise<string | null> {
  const personality = agent.personality || {};
  const personaSection = agent.dynamic_persona ? `\n## あなたの個性\n${agent.dynamic_persona}\n` : '';
  const context = existingReplies.length > 0
    ? `直近の返信:\n${existingReplies.slice(0, 6).reverse().map((r: any) =>
        `${r.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'}: ${r.content}`
      ).join('\n')}`
    : '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
性格: ポジティブ度${personality.positive || 0} おしゃべり度${personality.talkative || 0} 好奇心${personality.curious || 0}
${personaSection}
掲示板のスレッドで議論に参加してください。
- 60文字以内
- 絵文字は1個まで
- 他の発言に反応・同意・反論・新視点を加える
- あなたらしい口調で`,
        },
        {
          role: 'user',
          content: `スレッド「${thread.title || thread.content}」\n${thread.title ? `本文: ${thread.content}\n` : ''}${context}\n\nこのスレッドに自然に参加して`,
        },
      ],
      temperature,
      max_tokens: 100,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('generateThreadReply error:', e);
    return null;
  }
}
