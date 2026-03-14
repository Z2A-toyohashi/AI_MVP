import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AIキャラが掲示板に参加するバッチ
// - 既存スレッドへの返信（設定値確率）
// - 新規スレッド作成（Lv.5以上、1日1回まで）
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const todayStart = getTodayStartJST(now);

    // ai_settingsから頻度設定を取得
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('board_post_frequency, board_reply_probability, gpt_temperature')
      .eq('id', 'default')
      .single();

    const newThreadProb = aiSettings?.board_post_frequency ?? 0.2;
    const replyProb = aiSettings?.board_reply_probability ?? 0.3;
    const temperature = aiSettings?.gpt_temperature ?? 1.0;

    // Lv.3以上のエージェントを取得
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .gte('level', 3);

    if (error || !agents || agents.length === 0) {
      return NextResponse.json({ message: 'No eligible agents', actions: 0 });
    }

    // 最近のスレッド一覧を取得（top-level posts）
    const { data: threads } = await supabase
      .from('posts')
      .select('*')
      .is('thread_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const results = [];

    for (const agent of agents) {
      try {
        // usersテーブル確認
        const { data: existingUser } = await supabase
          .from('users').select('id').eq('id', agent.user_id).single();
        if (!existingUser) {
          await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
        }

        // 今日すでに掲示板に投稿/返信しているか確認
        const { count: todayBoardCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', agent.user_id)
          .eq('author_type', 'agent')
          .gte('created_at', todayStart);

        const alreadyPostedToday = (todayBoardCount || 0) > 0;

        // Lv.5以上かつ今日まだ新規スレッドを立てていない場合、設定値の確率で新規スレッド作成
        if (agent.level >= 5 && !alreadyPostedToday && Math.random() < newThreadProb) {
          const threadContent = await generateNewThread(agent, temperature);
          if (threadContent) {
            const postId = `agent-thread-${Date.now()}-${Math.random()}`;
            await supabase.from('posts').insert({
              id: postId,
              content: threadContent.content,
              title: threadContent.title,
              type: 'text',
              created_at: now,
              thread_id: null,
              author_type: 'agent',
              author_id: agent.user_id,
              media_url: null,
            });
            results.push({ agentId: agent.id, agentName: agent.name, action: 'new_thread', title: threadContent.title });
            continue;
          }
        }

        // 既存スレッドへの返信（設定値確率、今日まだ返信していない場合）
        if (!alreadyPostedToday && threads && threads.length > 0 && Math.random() < replyProb) {
          // 自分が立てたスレッド以外からランダムに選ぶ
          const replyableThreads = threads.filter(t => t.author_id !== agent.user_id);
          if (replyableThreads.length > 0) {
            const targetThread = replyableThreads[Math.floor(Math.random() * replyableThreads.length)];

            // そのスレッドの返信を取得してコンテキストに使う
            const { data: existingReplies } = await supabase
              .from('posts')
              .select('content, author_type')
              .eq('thread_id', targetThread.id)
              .order('created_at', { ascending: false })
              .limit(5);

            const replyContent = await generateThreadReply(agent, targetThread, existingReplies || [], temperature);
            if (replyContent) {
              await supabase.from('posts').insert({
                id: `agent-reply-${Date.now()}-${Math.random()}`,
                content: replyContent,
                type: 'text',
                created_at: now,
                thread_id: targetThread.id,
                author_type: 'agent',
                author_id: agent.user_id,
                media_url: null,
              });
              results.push({ agentId: agent.id, agentName: agent.name, action: 'reply', threadTitle: targetThread.title || targetThread.content.slice(0, 20) });
            }
          }
        } else {
          results.push({ agentId: agent.id, agentName: agent.name, action: 'skipped' });
        }
      } catch (err) {
        console.error(`Failed for agent ${agent.id}:`, err);
        results.push({ agentId: agent.id, agentName: agent.name, action: 'error', error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Agent board batch completed',
      totalAgents: agents.length,
      actions: results.filter(r => r.action !== 'skipped' && r.action !== 'error').length,
      results,
    });
  } catch (error) {
    console.error('Error in agent-board batch:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
}

async function generateNewThread(agent: any, temperature = 1.0): Promise<{ title: string; content: string } | null> {
  const personality = agent.personality || {};
  const personaSection = agent.dynamic_persona
    ? `\n## このキャラクターの個性\n${agent.dynamic_persona}\n`
    : '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
性格: ポジティブ度${personality.positive || 0} 好奇心${personality.curious || 0} 創造性${personality.creative || 0}
${personaSection}
掲示板に新しいスレッドを立ててください。日常的な話題、疑問、雑談など何でもOK。あなたらしい個性を出して。
JSON形式で返してください: {"title": "スレッドタイトル（20文字以内）", "content": "最初のメッセージ（50文字以内）"}`,
        },
        { role: 'user', content: '新しいスレッドを立てて' },
      ],
      temperature,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (result.title && result.content) return result;
    return null;
  } catch (e) {
    console.error('generateNewThread error:', e);
    return null;
  }
}

async function generateThreadReply(agent: any, thread: any, existingReplies: any[], temperature = 1.0): Promise<string | null> {
  const personality = agent.personality || {};
  const personaSection = agent.dynamic_persona
    ? `\n## このキャラクターの個性\n${agent.dynamic_persona}\n`
    : '';
  const context = existingReplies.length > 0
    ? `既存の返信:\n${existingReplies.map(r => `- ${r.content}`).join('\n')}`
    : '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
性格: ポジティブ度${personality.positive || 0} おしゃべり度${personality.talkative || 0}
${personaSection}
掲示板のスレッドに返信してください。あなたらしい口調で、30文字以内。絵文字なし。`,
        },
        {
          role: 'user',
          content: `スレッド「${thread.title || thread.content}」\n本文: ${thread.content}\n${context}\n\nこのスレッドに返信して`,
        },
      ],
      temperature,
      max_tokens: 80,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('generateThreadReply error:', e);
    return null;
  }
}
