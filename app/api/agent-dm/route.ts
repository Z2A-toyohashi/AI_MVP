import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// DM一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const agentId = request.nextUrl.searchParams.get('agentId');

    let query = supabase
      .from('agent_dms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (agentId) {
      query = query.or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ dms: [] });

    return NextResponse.json({ dms: data || [] });
  } catch (e) {
    return NextResponse.json({ dms: [] });
  }
}

// DM生成（バッチから呼ばれる）
export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase();

    // level 3以上のエージェントを取得
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, personality, level, appearance_stage')
      .gte('level', 3)
      .limit(10);

    if (error || !agents || agents.length < 2) {
      return NextResponse.json({ message: 'Not enough agents' });
    }

    // ランダムにペアを選ぶ
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const sender = shuffled[0];
    const receiver = shuffled[1];

    // 最近のDM履歴を取得（同じペアの直近3件）
    const { data: recentDms } = await supabase
      .from('agent_dms')
      .select('from_agent_name, message, reply')
      .or(`and(from_agent_id.eq.${sender.id},to_agent_id.eq.${receiver.id}),and(from_agent_id.eq.${receiver.id},to_agent_id.eq.${sender.id})`)
      .order('created_at', { ascending: false })
      .limit(3);

    const historyText = recentDms && recentDms.length > 0
      ? recentDms.reverse().map(d => `${d.from_agent_name}: ${d.message}\n返信: ${d.reply || '(未返信)'}`).join('\n')
      : '';

    const senderTraits = getTraits(sender.personality);
    const receiverTraits = getTraits(receiver.personality);

    // DMメッセージを生成
    const prompt = `${sender.name}（${senderTraits}）が${receiver.name}（${receiverTraits}）にDMを送ります。
${historyText ? `過去のやり取り:\n${historyText}\n` : ''}
自然な友達同士のDMを1文で生成してください。絵文字なし、20文字以内。
JSON: {"message": "...", "reply": "..."}
replyは${receiver.name}の返信（15文字以内）`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.1,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    if (!result.message) return NextResponse.json({ message: 'Failed to generate DM' });

    const now = Date.now();
    await supabase.from('agent_dms').insert({
      from_agent_id: sender.id,
      to_agent_id: receiver.id,
      from_agent_name: sender.name,
      to_agent_name: receiver.name,
      message: result.message,
      reply: result.reply || null,
      created_at: now,
    });

    return NextResponse.json({ success: true, from: sender.name, to: receiver.name, message: result.message });
  } catch (e) {
    console.error('agent-dm POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTraits(personality: any): string {
  if (!personality) return '普通';
  const p = personality;
  const traits = [];
  if ((p.positive || 0) > 3) traits.push('明るい');
  else if ((p.positive || 0) < -3) traits.push('少し暗め');
  if ((p.talkative || 0) > 3) traits.push('おしゃべり');
  if ((p.curious || 0) > 3) traits.push('好奇心旺盛');
  if ((p.creative || 0) > 3) traits.push('クリエイティブ');
  return traits.join('・') || '普通';
}
