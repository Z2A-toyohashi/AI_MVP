import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 最新の公園会話を取得（フロントがポーリング）
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const since = request.nextUrl.searchParams.get('since') || '0';

    const { data, error } = await supabase
      .from('park_conversations')
      .select('*')
      .gt('created_at', parseInt(since))
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      // テーブルが存在しない場合は空を返す
      return NextResponse.json({ turns: [] });
    }

    return NextResponse.json({ turns: data || [] });
  } catch (e) {
    return NextResponse.json({ turns: [] });
  }
}

// 公園の会話を生成してDBに保存（バッチから呼ばれる）
export async function POST(request: NextRequest) {
  try {
    const { agents, recentPosts } = await request.json();

    if (!agents || agents.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 agents' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const groupId = `group-${Date.now()}`;

    // 2〜3体のグループをランダムに選ぶ（最大2グループ）
    const shuffled = [...agents].sort(() => Math.random() - 0.5);

    const group1Size = Math.min(shuffled.length >= 3 && Math.random() > 0.5 ? 3 : 2, shuffled.length);
    const group1Agents = shuffled.slice(0, group1Size);
    const remaining = shuffled.slice(group1Size);
    const group2Agents = remaining.length >= 2 ? remaining.slice(0, 2) : [];

    const topicPosts = (recentPosts || []).slice(0, 5);
    const topicText = topicPosts.length > 0
      ? topicPosts.map((p: any) => `「${p.content}」`).join('、')
      : '最近の出来事';

    const groups = [];

    const conv1 = await generateGroupConversation(group1Agents, topicText);
    if (conv1) {
      groups.push(conv1);
      // DBに保存
      await saveConversationToDB(supabase, conv1, `${groupId}-1`);
    }

    if (group2Agents.length >= 2) {
      const conv2 = await generateGroupConversation(group2Agents, topicText);
      if (conv2) {
        groups.push(conv2);
        await saveConversationToDB(supabase, conv2, `${groupId}-2`);
      }
    }

    // 24時間以上前のデータを削除
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    try { await supabase.from('park_conversations').delete().lt('created_at', cutoff); } catch (_) {}

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error generating park conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function saveConversationToDB(supabase: any, conv: any, groupId: string) {
  try {
    const now = Date.now();
    const rows = conv.turns.map((t: any, i: number) => ({
      agent_id: t.agentId,
      agent_name: t.agentName,
      message: t.message,
      group_id: groupId,
      topic: conv.topic,
      created_at: now + i * 3000, // 3秒ずつずらして保存
    }));
    await supabase.from('park_conversations').insert(rows);
  } catch (e) {
    console.error('saveConversationToDB error:', e);
  }
}

async function generateGroupConversation(
  agents: Array<{ id: string; name: string; personality?: any; level?: number }>,
  topicText: string
): Promise<any | null> {
  try {
    const agentDescriptions = agents.map(a => {
      const p = a.personality || {};
      const traits = [];
      if ((p.positive || 0) > 3) traits.push('明るい');
      else if ((p.positive || 0) < -3) traits.push('少し暗め');
      if ((p.talkative || 0) > 3) traits.push('おしゃべり');
      if ((p.curious || 0) > 3) traits.push('好奇心旺盛');
      if ((p.logical || 0) > 3) traits.push('論理的');
      if ((p.emotional || 0) > 3) traits.push('感情豊か');
      return `${a.name}（${traits.join('・') || '普通'}）`;
    }).join('、');

    const agentNames = agents.map(a => a.name).join('、');

    const prompt = `公園で${agentDescriptions}が集まって話しています。
最近のタイムラインの話題: ${topicText}

この話題について、${agentNames}が自然に会話する3〜4ターンのセリフを作ってください。
各キャラの性格を反映させ、タイムラインの内容に触れながら話してください。

必ずJSON形式で返してください:
{
  "topic": "会話のテーマ（10文字以内）",
  "turns": [
    {"name": "キャラ名", "message": "セリフ（20文字以内）"},
    ...
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (!result.turns || result.turns.length === 0) return null;

    const nameToId = new Map(agents.map(a => [a.name, a.id]));

    return {
      agentIds: agents.map(a => a.id),
      topic: result.topic || '雑談',
      turns: result.turns.map((t: any) => ({
        agentId: nameToId.get(t.name) || agents[0].id,
        agentName: t.name,
        message: t.message,
      })),
    };
  } catch (e) {
    console.error('generateGroupConversation error:', e);
    return null;
  }
}
