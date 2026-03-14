import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// キャラごとの動的ペルソナを生成・更新するバッチ
// 会話履歴 + 掲示板投稿/返信 をもとにGPTがペルソナ文を生成
// vercel.json: 毎日1回実行推奨
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const now = Date.now();

  // 全エージェントを取得
  const { data: agents, error } = await supabase.from('agents').select('*');
  if (error || !agents) return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });

  const results = [];

  for (const agent of agents) {
    try {
      // 直近の会話履歴（最新50件）
      const { data: conversations } = await supabase
        .from('conversations')
        .select('role, content, created_at')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // 掲示板での投稿・返信（最新30件）
      const { data: boardPosts } = await supabase
        .from('posts')
        .select('content, thread_id, created_at')
        .eq('author_id', agent.user_id)
        .eq('author_type', 'agent')
        .order('created_at', { ascending: false })
        .limit(30);

      // ナレッジ
      const { data: knowledge } = await supabase
        .from('agent_knowledge')
        .select('topic, summary, importance')
        .eq('agent_id', agent.id)
        .order('importance', { ascending: false })
        .limit(10);

      if ((!conversations || conversations.length < 3) && (!boardPosts || boardPosts.length === 0)) {
        results.push({ agentId: agent.id, skipped: true, reason: 'not enough data' });
        continue;
      }

      const persona = await generatePersona(agent, conversations || [], boardPosts || [], knowledge || []);
      if (!persona) {
        results.push({ agentId: agent.id, skipped: true, reason: 'generation failed' });
        continue;
      }

      await supabase.from('agents').update({
        dynamic_persona: persona,
        persona_updated_at: now,
      }).eq('id', agent.id);

      results.push({ agentId: agent.id, agentName: agent.name, updated: true, personaLength: persona.length });
    } catch (err) {
      console.error(`Persona update failed for agent ${agent.id}:`, err);
      results.push({ agentId: agent.id, error: String(err) });
    }
  }

  return NextResponse.json({ message: 'Persona update completed', results });
}

// テスト用: 特定エージェントのペルソナを即時更新
export async function POST(request: NextRequest) {
  const { agentId } = await request.json();
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

  const supabase = getServerSupabase();
  const now = Date.now();

  const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const { data: conversations } = await supabase
    .from('conversations').select('role, content, created_at')
    .eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50);

  const { data: boardPosts } = await supabase
    .from('posts').select('content, thread_id, created_at')
    .eq('author_id', agent.user_id).eq('author_type', 'agent')
    .order('created_at', { ascending: false }).limit(30);

  const { data: knowledge } = await supabase
    .from('agent_knowledge').select('topic, summary, importance')
    .eq('agent_id', agentId).order('importance', { ascending: false }).limit(10);

  const persona = await generatePersona(agent, conversations || [], boardPosts || [], knowledge || []);
  if (!persona) return NextResponse.json({ error: 'Generation failed' }, { status: 500 });

  await supabase.from('agents').update({ dynamic_persona: persona, persona_updated_at: now }).eq('id', agentId);

  return NextResponse.json({ success: true, persona });
}

async function generatePersona(agent: any, conversations: any[], boardPosts: any[], knowledge: any[]): Promise<string | null> {
  const convText = conversations.length > 0
    ? conversations.slice(0, 30).reverse()
        .map(c => `${c.role === 'user' ? 'ユーザー' : 'AI'}: ${c.content}`)
        .join('\n')
    : '（会話なし）';

  const boardText = boardPosts.length > 0
    ? boardPosts.map(p => `- ${p.thread_id ? '返信' : '投稿'}: ${p.content}`).join('\n')
    : '（掲示板投稿なし）';

  const knowledgeText = knowledge.length > 0
    ? knowledge.map(k => `- ${k.topic}: ${k.summary}`).join('\n')
    : '（ナレッジなし）';

  const prompt = `以下はAIキャラクター「${agent.name}」の活動記録です。
これをもとに、このキャラクターの「動的ペルソナ」を生成してください。

## ユーザーとの会話履歴
${convText}

## 掲示板での発言
${boardText}

## 蓄積されたナレッジ
${knowledgeText}

---

上記をもとに、以下の観点でこのキャラクターのペルソナを300文字以内で記述してください：
- 口調・話し方の特徴（どんな言葉を使うか、どんなリズムで話すか）
- 思想・価値観（何を大切にしているか、どんな考え方をするか）
- 興味・関心（よく話す話題、好きなこと）
- ユーザーとの関係性（どんな距離感か、どんな接し方をするか）
- 独自の口癖や表現があれば

ペルソナ文のみ返してください（見出しや箇条書き不要、地の文で）。`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'あなたはAIキャラクターのペルソナ設計者です。与えられた情報から、そのキャラクターらしい個性を抽出して記述してください。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 400,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('generatePersona error:', e);
    return null;
  }
}
