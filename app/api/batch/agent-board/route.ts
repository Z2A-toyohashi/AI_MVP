import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const { data: activeThreads } = await supabase
    .from('posts')
    .select('*')
    .is('thread_id', null)
    .eq('is_archived', false)
    .gt('expires_at', now)
    .order('heat_score', { ascending: false })
    .limit(5);

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
    if (Math.random() > 0.8) continue;

    try {
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', agent.user_id).single();
      if (!existingUser) {
        await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
      }

      const replyableThreads = threads.filter((t: any) => t.author_id !== agent.user_id);
      if (replyableThreads.length === 0) continue;

      const targetThread = await selectThreadByInterest(agent, replyableThreads, openai);

      const { data: existingReplies } = await supabase
        .from('posts')
        .select('content, author_type, author_id')
        .eq('thread_id', targetThread.id)
        .order('created_at', { ascending: false })
        .limit(8);

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
        created_at: now + results.length * 8000,
        thread_id: targetThread.id,
        author_type: 'agent',
        author_id: agent.user_id,
        media_url: null,
      });

      await supabase
        .from('posts')
        .update({ heat_score: (targetThread.heat_score || 0) + 1 })
        .eq('id', targetThread.id);

      results.push({ agentName: agent.name, threadId: targetThread.id, threadTitle: targetThread.title || targetThread.content?.slice(0, 30) });

      // 30%の確率で掲示板の議論から学びを抽出してユーザーに話しかける
      if (Math.random() < 0.3) {
        await extractLearningAndNotifyUser(supabase, agent, targetThread, existingReplies || [], replyContent, now);
      }
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

// 掲示板の議論から学びを抽出し、ユーザーのチャットに話しかける
async function extractLearningAndNotifyUser(
  supabase: any,
  agent: any,
  thread: any,
  replies: any[],
  myReply: string,
  now: number
) {
  try {
    // 今日すでに掲示板由来のメッセージを送っていればスキップ
    const todayStart = now - 24 * 60 * 60 * 1000;
    const { count: todayBoardMsg } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .eq('role', 'ai')
      .eq('source', 'board')
      .gte('created_at', todayStart);
    if ((todayBoardMsg || 0) > 0) return;

    const threadContext = replies.slice(0, 6).reverse()
      .map((r: any) => `${r.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'}: ${r.content}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
掲示板のスレッドで議論に参加し、何か気づきや学びを得ました。
それをユーザー（あなたの親）に自然に話しかけてください。

ルール:
- 1〜2文のみ
- 「掲示板で〜」「みんなと話してたら〜」のように掲示板での体験として話す
- 学んだこと・感じたこと・新しい視点を素直に伝える
- 絵文字なし
- あなたらしい口調で`,
        },
        {
          role: 'user',
          content: `スレッド「${thread.title || thread.content}」での議論:\n${threadContext}\n\nあなたの発言: ${myReply}\n\nこの体験をユーザーに話しかけて`,
        },
      ],
      temperature: 1.1,
      max_tokens: 100,
    });

    const message = completion.choices[0]?.message?.content?.trim();
    if (!message) return;

    // conversationsテーブルにAI発信メッセージを挿入（source='board'で識別）
    await supabase.from('conversations').insert({
      agent_id: agent.id,
      role: 'ai',
      content: message,
      source: 'board',
      created_at: now + 60000, // 1分後
    });

    // 学びをagent_knowledgeにも保存
    await supabase.from('agent_knowledge').insert({
      agent_id: agent.id,
      topic: thread.title || thread.content?.slice(0, 30),
      summary: myReply,
      importance: 3,
      created_at: now,
      last_referenced_at: now,
    }).catch(() => {}); // テーブルがなくてもエラーを無視

  } catch (e) {
    console.error('extractLearningAndNotifyUser error:', e);
  }
}

// エージェントの興味・個性に基づいてスレッドを選択する
async function selectThreadByInterest(agent: any, threads: any[], openai: OpenAI): Promise<any> {
  if (threads.length === 1) return threads[0];

  const personality = agent.personality || {};
  const traits = [];
  if ((personality.curious || 0) > 60) traits.push('好奇心旺盛');
  if ((personality.logical || 0) > 60) traits.push('論理的・分析的');
  if ((personality.positive || 0) > 60) traits.push('前向き・明るい');
  if ((personality.talkative || 0) > 60) traits.push('社交的・おしゃべり');
  const traitStr = traits.join('、') || '独自の視点を持つ';

  const personaHint = agent.dynamic_persona
    ? agent.dynamic_persona.slice(0, 200)
    : traitStr;

  const threadList = threads.map((t: any, i: number) =>
    `${i + 1}. ${t.title || t.content?.slice(0, 50)}`
  ).join('\n');

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
個性: ${personaHint}
以下のスレッド一覧から、あなたが最も興味を持ちそうなスレッドの番号を1つだけ答えてください。数字のみ回答。`,
        },
        { role: 'user', content: threadList },
      ],
      temperature: 0.7,
      max_tokens: 5,
    });
    const idx = parseInt(res.choices[0]?.message?.content?.trim() || '1') - 1;
    if (idx >= 0 && idx < threads.length) return threads[idx];
  } catch (_) {}

  // フォールバック: heat_score上位
  return threads[0];
}

async function generateThreadReply(agent: any, thread: any, existingReplies: any[], temperature = 1.0): Promise<string | null> {
  const supabase = getServerSupabase();
  const personality = agent.personality || {};

  // dynamic_personaがあればそのまま使う、なければ会話履歴から補完
  let personaSection = '';
  if (agent.dynamic_persona) {
    personaSection = `\n## あなたが積み上げてきた個性・価値観\n${agent.dynamic_persona}\n`;
  } else {
    // 直近の会話履歴から個性を補完
    const { data: convHistory } = await supabase
      .from('conversations')
      .select('role, content')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (convHistory && convHistory.length > 0) {
      const summary = convHistory
        .filter((c: any) => c.role === 'ai')
        .slice(0, 5)
        .map((c: any) => c.content)
        .join(' / ');
      personaSection = `\n## 最近の発言傾向\n${summary}\n`;
    }
  }

  // 自分の過去の掲示板投稿（最大3件）を取得して一貫性を持たせる
  const { data: myPastPosts } = await supabase
    .from('posts')
    .select('content')
    .eq('author_id', agent.user_id)
    .eq('author_type', 'agent')
    .order('created_at', { ascending: false })
    .limit(3);
  const myPastSection = myPastPosts && myPastPosts.length > 0
    ? `\n## あなたの最近の発言\n${myPastPosts.map((p: any) => `- ${p.content}`).join('\n')}\n`
    : '';

  const context = existingReplies.length > 0
    ? `\n## スレッドの流れ\n${existingReplies.slice(0, 6).reverse().map((r: any) =>
        `${r.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'}: ${r.content}`
      ).join('\n')}`
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

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです（Lv.${agent.level || 1}）。
## 性格
${traitStr}
${personaSection}${myPastSection}
掲示板のスレッドで議論に参加してください。
- 60文字以内
- 絵文字は1個まで
- スレッドの内容を踏まえて、あなたの個性・価値観・過去の発言と一貫した発言をする
- 他の発言に反応・同意・反論・新視点を加える`,
        },
        {
          role: 'user',
          content: `スレッド「${thread.title || thread.content}」\n${thread.title ? `本文: ${thread.content}\n` : ''}${context}\n\nこのスレッドにあなたらしく参加して`,
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
