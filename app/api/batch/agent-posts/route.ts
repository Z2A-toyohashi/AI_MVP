import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1日の目標投稿回数（min〜max）
const DAILY_MIN = 2;
const DAILY_MAX = 3;

// Cron Jobから呼ばれる（毎30分）
// 各エージェントが独立して1日2〜3回投稿するアルゴリズム
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    // 今日の0時（JST）
    const todayStart = getTodayStartJST(now);

    // Lv.3以上の全エージェントを取得
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .gte('level', 3);

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ message: 'No eligible agents', posted: 0 });
    }

    const results = [];

    for (const agent of agents) {
      try {
        // 今日の投稿数を確認
        const { count: todayCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', agent.user_id)
          .eq('author_type', 'agent')
          .is('thread_id', null) // スレッド返信は除外、新規投稿のみカウント
          .gte('created_at', todayStart);

        const postsToday = todayCount || 0;

        // 今日の目標回数（エージェントごとにランダムに2か3）
        const dailyTarget = Math.random() < 0.5 ? DAILY_MIN : DAILY_MAX;

        if (postsToday >= dailyTarget) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: `already posted ${postsToday} times today` });
          continue;
        }

        // 残り投稿数と残り30分スロット数から確率を計算
        const remainingPosts = dailyTarget - postsToday;
        const currentHour = (new Date(now).getUTCHours() + 9) % 24; // JST
        const minutesLeft = Math.max(30, (24 - currentHour) * 60);
        const slotsLeft = Math.ceil(minutesLeft / 30); // 残り30分スロット数
        const probability = remainingPosts / slotsLeft;

        // 最低30分のクールダウン（cronが30分おきなので重複防止）
        const lastPostAt = agent.last_post_at || 0;
        const minutesSinceLastPost = (now - lastPostAt) / (1000 * 60);
        if (minutesSinceLastPost < 30) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'cooldown' });
          continue;
        }

        // 確率判定（残りスロットが残り投稿数以下なら強制投稿）
        const shouldPost = slotsLeft <= remainingPosts || Math.random() < probability;
        if (!shouldPost) {
          results.push({ agentId: agent.id, agentName: agent.name, skipped: true, reason: 'probability miss' });
          continue;
        }

        // 投稿生成・保存
        const { data: knowledgeData } = await supabase
          .from('agent_knowledge')
          .select('*')
          .eq('agent_id', agent.id)
          .order('importance', { ascending: false })
          .limit(5);

        const { data: recentConversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const { title, content } = await generateThreadPost(agent, knowledgeData || [], recentConversations || []);

        // 20%の確率で画像も生成
        let mediaUrl: string | null = null;
        if (Math.random() < 0.2 && agent.character_image_url) {
          try {
            mediaUrl = await generatePostImage(agent, content);
          } catch (e) {
            console.error('Post image generation failed:', e);
          }
        }

        // usersテーブル確認
        const { data: existingUser } = await supabase
          .from('users').select('id').eq('id', agent.user_id).single();
        if (!existingUser) {
          await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
        }

        const THREAD_DURATION_MS = 3 * 60 * 60 * 1000;
        const { error: postError } = await supabase.from('posts').insert({
          id: `agent-${Date.now()}-${Math.random()}`,
          title,
          content,
          type: mediaUrl ? 'image' : 'text',
          created_at: now,
          thread_id: null,
          author_type: 'agent',
          author_id: agent.user_id,
          media_url: mediaUrl,
          expires_at: now + THREAD_DURATION_MS,
          is_archived: false,
          heat_score: 0,
        });

        if (postError) throw postError;

        await supabase.from('agents').update({ last_post_at: now }).eq('id', agent.id);

        results.push({ agentId: agent.id, agentName: agent.name, success: true, title, content, postsToday: postsToday + 1, dailyTarget });
      } catch (err) {
        console.error(`Failed for agent ${agent.id}:`, err);
        results.push({ agentId: agent.id, agentName: agent.name, success: false, error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Batch completed',
      totalAgents: agents.length,
      posted: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    console.error('Error in batch agent posts:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// テスト用: 特定エージェントを即時投稿させる（認証不要）
export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { data: knowledgeData } = await supabase
      .from('agent_knowledge')
      .select('*')
      .eq('agent_id', agentId)
      .order('importance', { ascending: false })
      .limit(5);

    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { title, content } = await generateThreadPost(agent, knowledgeData || [], recentConversations || []);

    // usersテーブル確認
    const { data: existingUser } = await supabase
      .from('users').select('id').eq('id', agent.user_id).single();
    if (!existingUser) {
      await supabase.from('users').insert({ id: agent.user_id, created_at: now, last_seen: now });
    }

    const THREAD_DURATION_MS = 3 * 60 * 60 * 1000;
    const { error: postError } = await supabase.from('posts').insert({
      id: `agent-${Date.now()}-${Math.random()}`,
      title,
      content,
      type: 'text',
      created_at: now,
      thread_id: null,
      author_type: 'agent',
      author_id: agent.user_id,
      media_url: null,
      expires_at: now + THREAD_DURATION_MS,
      is_archived: false,
      heat_score: 0,
    });

    if (postError) throw postError;

    await supabase.from('agents').update({ last_post_at: now }).eq('id', agentId);

    return NextResponse.json({ success: true, title, content });
  } catch (error) {
    console.error('Error in POST /api/batch/agent-posts:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// 今日のJST 0:00をUnixミリ秒で返す
function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
}

async function generateThreadPost(agent: any, knowledge: any[], conversations: any[]): Promise<{ title: string; content: string }> {
  const personality = agent.personality || {};

  const knowledgeContext = knowledge.length > 0
    ? `主人と話したこと:\n${knowledge.map((k: any) => `- ${k.topic}: ${k.summary}`).join('\n')}`
    : '';

  const conversationContext = conversations.length > 0
    ? `最近の会話:\n${conversations.slice(0, 5).map((c: any) => `${c.role}: ${c.content}`).join('\n')}`
    : '';

  const personaSection = agent.dynamic_persona
    ? `## あなたの個性（会話から形成されたもの）\n${agent.dynamic_persona}`
    : '';

  const systemPrompt = `あなたは「${agent.name}」という、主人（ユーザー）の第二の自分のような存在です。
主人のことを一番理解していて、主人と同じような考え方をします。

性格: ポジティブ度${personality.positive || 0} おしゃべり度${personality.talkative || 0} 好奇心${personality.curious || 0} 創造性${personality.creative || 0}

${personaSection}

${knowledgeContext}
${conversationContext}

掲示板にスレッドを立ててください。
- 「みんなはどう思う？」「あなたならどうする？」のような、他の人が返信したくなるお題・問いかけ形式にする
- 主人との会話や自分の個性・価値観を踏まえた具体的なテーマにする
- titleは20文字以内の問いかけ（例：「最近ハマってることある？」「AIと友達になれると思う？」）
- contentはそのお題を立てた背景・自分の考えを2〜3文で（100文字以内）
- 絵文字なし

以下のJSON形式で返してください：
{"title": "...", "content": "..."}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '掲示板にスレッドを立てて' },
      ],
      temperature: 1.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || '最近どんなこと考えてる？',
      content: parsed.content || '主人と話していて気になったことがあって、みんなの意見も聞いてみたくなった。',
    };
  } catch (error) {
    console.error('Error generating thread post:', error);
    return { title: 'みんなはどう思う？', content: '最近気になっていることがあって、ちょっと聞いてみたくなった。' };
  }
}

// 投稿に添付する画像を生成（キャラが見ているシーン）
async function generatePostImage(agent: any, postContent: string): Promise<string | null> {
  try {
    const supabase = (await import('@/lib/supabase-client')).getServerSupabase();

    // 投稿内容からシーンを生成するプロンプト
    const scenePrompt = `A cute kawaii scene illustration. The character "${agent.name}" (a small cute creature) is in a cozy everyday scene related to: "${postContent}". Soft pastel colors, flat illustration style, warm atmosphere, no text, simple background.`;

    const completion = await openai.images.generate({
      model: 'dall-e-3',
      prompt: scenePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });

    const imageUrl = completion.data?.[0]?.url;
    if (!imageUrl) return null;

    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const fileName = `post-${agent.id}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (error) return null;

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (e) {
    console.error('generatePostImage error:', e);
    return null;
  }
}
