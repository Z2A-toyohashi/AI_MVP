import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TOPIC_DURATION_MS = 3 * 60 * 60 * 1000; // 3時間
const AI_REPLY_INTERVAL_MS = 8 * 60 * 1000;   // AIは8分ごとに返信（バッチ実行時）

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runBatch();
}

// テスト用（認証不要）
export async function POST(_request: NextRequest) {
  return runBatch();
}

async function runBatch() {
  const supabase = getServerSupabase();
  const now = Date.now();

  // 期限切れのactiveトピックをアーカイブ＋議事録生成
  const { data: expiredTopics } = await supabase
    .from('discussion_topics')
    .select('*')
    .eq('status', 'active')
    .lt('ends_at', now);

  for (const topic of expiredTopics || []) {
    await archiveTopic(supabase, topic);
  }

  // 現在アクティブなお題があるか確認
  const { data: activeTopic } = await supabase
    .from('discussion_topics')
    .select('id, ends_at')
    .eq('status', 'active')
    .gt('ends_at', now)
    .single();

  let topicId: string;

  if (activeTopic) {
    // アクティブなお題がある → AIキャラが参加するだけ
    topicId = activeTopic.id;
  } else {
    // 新しいお題を生成
    const newTopic = await generateTopic(supabase, now);
    if (!newTopic) return NextResponse.json({ error: 'Failed to generate topic' }, { status: 500 });
    topicId = newTopic.id;
  }

  // AIキャラたちがお題に参加
  const aiResults = await triggerAIParticipation(supabase, topicId, now);

  return NextResponse.json({
    message: 'Topic batch completed',
    topicId,
    newTopic: !activeTopic,
    aiParticipants: aiResults.length,
    aiResults,
  });
}

async function generateTopic(supabase: any, now: number) {
  // 最近のお題を取得して重複を避ける
  const { data: recentTopics } = await supabase
    .from('discussion_topics')
    .select('title')
    .order('created_at', { ascending: false })
    .limit(5);

  const recentTitles = (recentTopics || []).map((t: any) => t.title).join('、');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはオンラインコミュニティのファシリテーターです。
AIと人間が一緒に議論できる「お題」を生成してください。

条件:
- 賛否が分かれる、または多様な意見が出やすいテーマ
- 「〜についてどう思う？」「〜はアリ？ナシ？」「〜と〜どっちが好き？」など問いかけ形式
- 日常・テクノロジー・価値観・未来など幅広いジャンルから選ぶ
- 最近のお題と重複しない
- 誰でも気軽に意見を言えるテーマ

最近のお題: ${recentTitles || 'なし'}

JSON形式で返してください:
{"title": "お題タイトル（30文字以内、問いかけ形式）", "description": "補足説明・議論のきっかけになる一文（60文字以内）"}`,
        },
        { role: 'user', content: '新しいお題を生成して' },
      ],
      temperature: 1.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (!result.title) return null;

    const { data: topic, error } = await supabase
      .from('discussion_topics')
      .insert({
        title: result.title,
        description: result.description || '',
        generated_by: 'ai',
        status: 'active',
        starts_at: now,
        ends_at: now + TOPIC_DURATION_MS,
        reply_count: 0,
        participant_count: 0,
        heat_score: 0,
        created_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return topic;
  } catch (e) {
    console.error('generateTopic error:', e);
    return null;
  }
}

async function triggerAIParticipation(supabase: any, topicId: string, now: number) {
  const { data: topic } = await supabase
    .from('discussion_topics')
    .select('*')
    .eq('id', topicId)
    .single();
  if (!topic) return [];

  // Lv.3以上のエージェントを取得
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .gte('level', 3);

  if (!agents || agents.length === 0) return [];

  // 既にこのお題に投稿済みのエージェントを除外
  const { data: existingPosts } = await supabase
    .from('posts')
    .select('author_id')
    .eq('topic_id', topicId)
    .eq('author_type', 'agent');

  const postedAgentIds = new Set((existingPosts || []).map((p: any) => p.author_id));

  // 未参加のエージェントのみ（最大4体）
  const eligibleAgents = agents.filter((a: any) => !postedAgentIds.has(a.user_id)).slice(0, 4);

  const results = [];
  for (let i = 0; i < eligibleAgents.length; i++) {
    const agent = eligibleAgents[i];
    try {
      // usersテーブル確認
      const { data: existingUser } = await supabase.from('users').select('id').eq('id', agent.user_id).single();
      if (!existingUser) {
        await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
      }

      const content = await generateAIOpinion(agent, topic);
      if (!content) continue;

      const postId = `topic-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await supabase.from('posts').insert({
        id: postId,
        content,
        type: 'text',
        created_at: now + i * 30000, // 30秒ずつずらして投稿
        thread_id: null,
        topic_id: topicId,
        author_type: 'agent',
        author_id: agent.user_id,
        media_url: null,
      });

      results.push({ agentId: agent.id, agentName: agent.name, content });
    } catch (err) {
      console.error(`AI participation failed for ${agent.id}:`, err);
    }
  }

  // reply_count と participant_count を更新
  if (results.length > 0) {
    const { data: totalPosts } = await supabase
      .from('posts')
      .select('author_id', { count: 'exact' })
      .eq('topic_id', topicId);

    const uniqueParticipants = new Set((totalPosts || []).map((p: any) => p.author_id)).size;
    const replyCount = (totalPosts || []).length;
    const heatScore = replyCount * 2 + uniqueParticipants * 5;

    await supabase.from('discussion_topics').update({
      reply_count: replyCount,
      participant_count: uniqueParticipants,
      heat_score: heatScore,
    }).eq('id', topicId);
  }

  return results;
}

async function generateAIOpinion(agent: any, topic: any): Promise<string | null> {
  const personality = agent.personality || {};
  const personaSection = agent.dynamic_persona
    ? `\n## あなたの個性\n${agent.dynamic_persona}\n`
    : '';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」というAIキャラクターです。
性格: ポジティブ度${personality.positive || 0} 好奇心${personality.curious || 0} 論理性${personality.logical || 0}
${personaSection}
掲示板のお題に対して、あなたらしい意見・感想・体験を投稿してください。
- 60文字以内
- 絵文字なし
- あなたの個性・口調を反映させる
- 賛成・反対・別視点など、あなたらしい立場を明確に`,
        },
        {
          role: 'user',
          content: `お題「${topic.title}」\n${topic.description || ''}\n\nこのお題についてあなたの意見を投稿して`,
        },
      ],
      temperature: 1.1,
      max_tokens: 120,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('generateAIOpinion error:', e);
    return null;
  }
}

async function archiveTopic(supabase: any, topic: any) {
  const { data: posts } = await supabase
    .from('posts')
    .select('content, author_type, created_at')
    .eq('topic_id', topic.id)
    .order('created_at', { ascending: true });

  let summary = '議論なし';
  if (posts && posts.length > 0) {
    try {
      const text = posts.map((p: any) => `${p.author_type === 'agent' ? 'AI' : 'ユーザー'}: ${p.content}`).join('\n');
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
  }).eq('id', topic.id);
}
