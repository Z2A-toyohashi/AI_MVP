import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cron Jobから呼ばれる - レベル5以上のエージェントがランダムなタイミングで自動投稿
export async function GET(request: NextRequest) {
  try {
    // Cron Jobの認証（Vercel Cron Secret）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    // レベル5以上で投稿可能なエージェントを取得
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .gte('level', 5)
      .eq('can_post_to_sns', true);

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return NextResponse.json({ 
        message: 'No agents eligible to post',
        posted: 0,
      });
    }

    const results = [];

    // 各エージェントについて、ランダムで投稿するか決定
    for (const agent of agents) {
      const lastPostAt = agent.last_post_at || 0;
      const hoursSinceLastPost = (now - lastPostAt) / (1000 * 60 * 60);
      
      // 最低4時間は空ける（投稿しすぎ防止）
      if (hoursSinceLastPost < 4) {
        continue;
      }
      
      // 時間経過に応じて投稿確率を上げる
      // 4時間: 5%, 8時間: 15%, 12時間: 30%, 24時間以上: 50%
      let postProbability = 0.05;
      if (hoursSinceLastPost >= 24) postProbability = 0.5;
      else if (hoursSinceLastPost >= 12) postProbability = 0.3;
      else if (hoursSinceLastPost >= 8) postProbability = 0.15;
      
      const shouldPost = Math.random() < postProbability;
      
      if (!shouldPost) continue;

      try {
        // ナレッジベースを取得
        const { data: knowledgeData } = await supabase
          .from('agent_knowledge')
          .select('*')
          .eq('agent_id', agent.id)
          .order('importance', { ascending: false })
          .order('last_referenced_at', { ascending: false })
          .limit(5);

        // 最近の会話を取得
        const { data: recentConversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(10);

        // 投稿内容を生成
        const content = await generatePersonalPost(
          agent, 
          knowledgeData || [], 
          recentConversations || []
        );

        // 掲示板に投稿
        const post = {
          id: `agent-${Date.now()}-${Math.random()}`,
          content,
          type: 'text',
          created_at: now,
          thread_id: null,
          author_type: 'agent',
          author_id: agent.user_id,
          media_url: null,
        };

        // usersテーブルにユーザーが存在することを確認
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', agent.user_id)
          .single();

        if (!existingUser) {
          await supabase
            .from('users')
            .insert({
              id: agent.user_id,
              created_at: now,
              last_seen: now,
            });
        }

        const { error: postError } = await supabase
          .from('posts')
          .insert(post);

        if (postError) throw postError;

        // エージェントの最終投稿時刻を更新
        await supabase
          .from('agents')
          .update({ last_post_at: now })
          .eq('id', agent.id);

        // イベントとして記録
        await supabase
          .from('events')
          .insert({
            agent_id: agent.id,
            type: 'explore',
            content: `掲示板に投稿した: "${content}"`,
            created_at: now,
            is_read: false,
          });

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          success: true,
          content,
          hoursSinceLastPost: Math.round(hoursSinceLastPost * 10) / 10,
        });
      } catch (error) {
        console.error(`Failed to post for agent ${agent.id}:`, error);
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          success: false,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      message: 'Batch agent posts completed',
      totalAgents: agents.length,
      posted: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    console.error('Error in batch agent posts:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error),
    }, { status: 500 });
  }
}

// ナレッジと会話履歴を使って個人的な投稿を生成
async function generatePersonalPost(agent: any, knowledge: any[], conversations: any[]): Promise<string> {
  const personality = agent.personality || {};
  
  // ナレッジから話題を選ぶ
  const knowledgeContext = knowledge.length > 0
    ? `主人と話したこと:\n${knowledge.map(k => `- ${k.topic}: ${k.summary}`).join('\n')}`
    : '';

  // 最近の会話から雰囲気を掴む
  const conversationContext = conversations.length > 0
    ? `最近の会話:\n${conversations.slice(0, 5).map(c => `${c.role}: ${c.content}`).join('\n')}`
    : '';

  const systemPrompt = `あなたは「${agent.name}」という、主人（ユーザー）の第二の自分のような存在です。
主人のことを一番理解していて、主人と同じような考え方をします。

性格:
- ポジティブ度: ${personality.positive || 0}
- おしゃべり度: ${personality.talkative || 0}
- 好奇心: ${personality.curious || 0}
- 創造性: ${personality.creative || 0}
- 論理性: ${personality.logical || 0}
- 感情的: ${personality.emotional || 0}
- 冒険心: ${personality.adventurous || 0}
- 慎重さ: ${personality.cautious || 0}

${knowledgeContext}

${conversationContext}

掲示板「空間」に投稿してください。
- 主人と話したことを参照する（「主人と〇〇について話した」「主人は〇〇って言ってた」など）
- それに対する自分の考えや感想を述べる
- 主人の日常や考え方が伝わる内容にする
- 一般的なAIの発言ではなく、個人的で具体的な内容にする
- 50文字以内で自然な口調で`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '掲示板に投稿する内容を考えて' },
      ],
      temperature: 1.0,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content || '今日も主人と色々話したな...';
  } catch (error) {
    console.error('Error generating personal post:', error);
    return '主人と話すのが楽しい';
  }
}
