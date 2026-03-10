import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ユーザーのAIキャラ → ユーザーへのDMを1日1回送る
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const todayStart = getTodayStartJST(now);

    // 全エージェントを取得（level問わず）
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, personality, level, user_id')
      .order('created_at', { ascending: true });

    if (error || !agents || agents.length === 0) {
      return NextResponse.json({ message: 'No agents found', sent: 0 });
    }

    const results = [];

    for (const agent of agents) {
      try {
        // 今日すでにユーザー宛DMを送っていたらスキップ
        const { count } = await supabase
          .from('agent_dms')
          .select('*', { count: 'exact', head: true })
          .eq('from_agent_id', agent.id)
          .is('to_agent_id', null)
          .gte('created_at', todayStart);

        if ((count || 0) > 0) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'already sent today' });
          continue;
        }

        // 最近の会話履歴を取得（コンテキストとして使う）
        const { data: recentConvs } = await supabase
          .from('conversations')
          .select('role, content')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(10);

        // 過去のユーザー宛DM履歴（直近3件）
        const { data: pastDms } = await supabase
          .from('agent_dms')
          .select('message, reply')
          .eq('from_agent_id', agent.id)
          .is('to_agent_id', null)
          .order('created_at', { ascending: false })
          .limit(3);

        const traits = getTraits(agent.personality);
        const convContext = recentConvs && recentConvs.length > 0
          ? recentConvs.reverse().map(c => `${c.role === 'user' ? '主人' : agent.name}: ${c.content}`).join('\n')
          : '';
        const dmHistory = pastDms && pastDms.length > 0
          ? pastDms.reverse().map(d => `${agent.name}: ${d.message}${d.reply ? `\n主人: ${d.reply}` : ''}`).join('\n')
          : '';

        const prompt = `あなたは「${agent.name}」（${traits}）。主人（ユーザー）の第二の自分のような存在です。
${convContext ? `最近の会話:\n${convContext}\n` : ''}${dmHistory ? `過去のDM:\n${dmHistory}\n` : ''}
今日、主人に送るDMを1文で考えてください。
会話の内容を踏まえた個人的なメッセージ。絵文字なし、30文字以内。
JSON: {"message": "..."}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 1.1,
          max_tokens: 100,
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
        if (!result.message) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'generation failed' });
          continue;
        }

        // is_readカラムがある場合のみセット
        const insertData: Record<string, unknown> = {
          from_agent_id: agent.id,
          to_agent_id: null,
          from_agent_name: agent.name,
          to_agent_name: 'あなた',
          message: result.message,
          reply: null,
          created_at: now,
        };
        try {
          await supabase.from('agent_dms').insert({ ...insertData, is_read: false });
        } catch {
          await supabase.from('agent_dms').insert(insertData);
        }

        results.push({ agentId: agent.id, agentName: agent.name, success: true, message: result.message });
      } catch (err) {
        results.push({ agentId: agent.id, agentName: agent.name, success: false, error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Batch completed',
      totalAgents: agents.length,
      sent: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
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
