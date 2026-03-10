import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// DM一覧取得 / 未読カウント
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const agentId = request.nextUrl.searchParams.get('agentId');
    const withAgentId = request.nextUrl.searchParams.get('withAgentId');
    const unreadCount = request.nextUrl.searchParams.get('unreadCount');

    // 未読カウントのみ返す（AIキャラ→ユーザー宛の未読）
    if (unreadCount === 'true') {
      const userId = request.nextUrl.searchParams.get('userId');
      if (!userId) return NextResponse.json({ unreadCount: 0 });
      try {
        const { count, error } = await supabase
          .from('agent_dms')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('to_agent_name', 'あなた')
          .neq('from_agent_name', 'あなた')
          .eq('is_read', false);
        if (error) return NextResponse.json({ unreadCount: 0 });
        return NextResponse.json({ unreadCount: count || 0 });
      } catch {
        return NextResponse.json({ unreadCount: 0 });
      }
    }

    if (withAgentId) {
      const myAgentId = request.nextUrl.searchParams.get('myAgentId');
      const userId = request.nextUrl.searchParams.get('userId');
      if (!userId) return NextResponse.json({ dms: [] });

      // ユーザー→そのキャラ（user_id一致 + to_agent_id=withAgentId）
      const { data: userSent } = await supabase
        .from('agent_dms')
        .select('*')
        .eq('user_id', userId)
        .eq('to_agent_id', withAgentId)
        .eq('from_agent_name', 'あなた')
        .order('created_at', { ascending: true })
        .limit(50);

      // そのキャラ→ユーザー（user_id一致 + from_agent_id=withAgentId）
      const { data: agentSent } = await supabase
        .from('agent_dms')
        .select('*')
        .eq('user_id', userId)
        .eq('from_agent_id', withAgentId)
        .eq('to_agent_name', 'あなた')
        .order('created_at', { ascending: true })
        .limit(50);

      const all = [...(userSent || []), ...(agentSent || [])];

      // 自分のキャラIDがあればAI同士DMも取得（user_id紐付き）
      if (myAgentId) {
        const { data: aiDms } = await supabase
          .from('agent_dms')
          .select('*')
          .eq('user_id', userId)
          .or(`and(from_agent_id.eq.${myAgentId},to_agent_id.eq.${withAgentId}),and(from_agent_id.eq.${withAgentId},to_agent_id.eq.${myAgentId})`)
          .order('created_at', { ascending: true })
          .limit(50);
        all.push(...(aiDms || []));
      }

      // 重複除去してcreated_at順にソート
      const seen = new Set<string>();
      const deduped = all
        .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
        .sort((a, b) => a.created_at - b.created_at);

      return NextResponse.json({ dms: deduped });
    }

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

// ユーザー → AIキャラへのDM送信
export async function PUT(request: NextRequest) {
  try {
    const { toAgentId, message, userId } = await request.json();
    if (!toAgentId || !message || !userId) {
      return NextResponse.json({ error: 'toAgentId, message and userId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 宛先エージェント情報を取得
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, personality, level')
      .eq('id', toAgentId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const traits = getTraits(agent.personality);

    // AIキャラの返信を生成
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたは「${agent.name}」（${traits}）。ユーザーからDMが届いた。1〜2文で自然に返信してください。絵文字なし。`,
        },
        { role: 'user', content: message },
      ],
      temperature: 1.0,
      max_tokens: 100,
    });

    const reply = completion.choices[0]?.message?.content || 'うん、なるほど。';

    // DBに保存
    const now = Date.now();
    const insertData: Record<string, unknown> = {
      user_id: userId,
      from_agent_id: null,
      to_agent_id: agent.id,
      from_agent_name: 'あなた',
      to_agent_name: agent.name,
      message,
      reply,
      created_at: now,
    };
    // is_readカラムが存在する場合のみセット（マイグレーション済みの場合）
    try {
      const { data: saved } = await supabase.from('agent_dms').insert({ ...insertData, is_read: true }).select().single();
      return NextResponse.json({ success: true, reply, agentName: agent.name, id: saved?.id });
    } catch {
      // is_readカラムがない場合はなしで保存
      const { data: saved } = await supabase.from('agent_dms').insert(insertData).select().single();
      return NextResponse.json({ success: true, reply, agentName: agent.name, id: saved?.id });
    }
  } catch (e) {
    console.error('agent-dm PUT error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 既読化（チャット画面を開いたとき）
export async function PATCH(request: NextRequest) {
  try {
    const { agentId, userId } = await request.json();
    if (!agentId || !userId) return NextResponse.json({ error: 'agentId and userId required' }, { status: 400 });

    const supabase = getServerSupabase();
    await supabase
      .from('agent_dms')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('from_agent_id', agentId)
      .eq('to_agent_name', 'あなた')
      .eq('is_read', false);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: true });
  }
}
