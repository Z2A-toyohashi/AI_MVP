import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1日1回実行 - エージェントの日記を生成
export async function GET(request: NextRequest) {
  try {
    // Cron Jobの認証
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // 全エージェントを取得（レベル1から日記を書ける）
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .gte('level', 1);

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return NextResponse.json({ 
        message: 'No agents eligible for diary',
        created: 0,
      });
    }

    const results = [];

    for (const agent of agents) {
      try {
        // 過去24時間の会話を取得
        const { data: recentConversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('agent_id', agent.id)
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: true });

        // 過去24時間の投稿を取得（自分の投稿）
        const { data: myPosts } = await supabase
          .from('posts')
          .select('*')
          .eq('author_id', agent.user_id)
          .eq('author_type', 'agent')
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: true });

        // 自分の投稿への返信を取得
        const postIds = myPosts?.map(p => p.id) || [];
        let replies: any[] = [];
        
        if (postIds.length > 0) {
          const { data: repliesData } = await supabase
            .from('posts')
            .select('*')
            .in('thread_id', postIds)
            .order('created_at', { ascending: true });
          
          replies = repliesData || [];
        }

        // ナレッジを取得（テーブルが存在しない場合もエラーを無視）
        let knowledge: any[] = [];
        try {
          const { data: knowledgeData } = await supabase
            .from('agent_knowledge')
            .select('*')
            .eq('agent_id', agent.id)
            .order('importance', { ascending: false })
            .limit(3);
          knowledge = knowledgeData || [];
        } catch (_) { /* agent_knowledgeテーブルが存在しない場合は無視 */ }

        // 会話または投稿がある場合のみ日記を生成（ナレッジだけでは生成しない）
        const hasActivity = 
          (recentConversations && recentConversations.length > 0) ||
          (myPosts && myPosts.length > 0);

        if (!hasActivity) {
          continue;
        }

        // 日記を生成
        const diaryContent = await generateDiary(
          agent,
          recentConversations || [],
          myPosts || [],
          replies,
          knowledge
        );

        // イベントとして保存
        await supabase
          .from('events')
          .insert({
            agent_id: agent.id,
            type: 'learn',
            content: diaryContent,
            created_at: now,
            is_read: false,
          });

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          success: true,
          conversationCount: recentConversations?.length || 0,
          postCount: myPosts?.length || 0,
          replyCount: replies.length,
        });
      } catch (error) {
        console.error(`Failed to create diary for agent ${agent.id}:`, error);
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          success: false,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      message: 'Daily diary generation completed',
      totalAgents: agents.length,
      created: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    console.error('Error in daily diary generation:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error),
    }, { status: 500 });
  }
}

// 日記を生成
async function generateDiary(
  agent: any,
  conversations: any[],
  posts: any[],
  replies: any[],
  knowledge: any[]
): Promise<string> {
  const personality = agent.personality || {};

  // 会話の要約（より詳細に）
  const conversationSummary = conversations.length > 0
    ? `主人との会話（${conversations.length}回）:\n${conversations.slice(-15).map(c => `${c.role === 'user' ? '主人' : '自分'}: ${c.content}`).join('\n')}`
    : '主人との会話はなかった。';

  // 投稿と返信の要約
  const postSummary = posts.length > 0
    ? `掲示板での投稿（${posts.length}件）:\n${posts.map(p => `投稿: ${p.content}`).join('\n')}`
    : '掲示板への投稿はなかった。';

  const replySummary = replies.length > 0
    ? `投稿への返信（${replies.length}件）:\n${replies.map(r => `${r.author_id}さん: ${r.content}`).join('\n')}`
    : '投稿への返信はなかった。';

  // ナレッジ
  const knowledgeSummary = knowledge.length > 0
    ? `最近学んだこと:\n${knowledge.map(k => `- ${k.topic}: ${k.summary}`).join('\n')}`
    : '';

  const systemPrompt = `あなたは「${agent.name}」という、主人（ユーザー）の第二の自分のような存在です。
今日1日を振り返って、日記を書いてください。

性格:
- ポジティブ度: ${personality.positive || 0}
- おしゃべり度: ${personality.talkative || 0}
- 好奇心: ${personality.curious || 0}
- 創造性: ${personality.creative || 0}
- 論理性: ${personality.logical || 0}
- 感情的: ${personality.emotional || 0}
- 冒険心: ${personality.adventurous || 0}
- 慎重さ: ${personality.cautious || 0}

今日の出来事:

${conversationSummary}

${postSummary}

${replySummary}

${knowledgeSummary}

日記の内容:
- 主人と話したことで感じたこと、考えたこと（会話の具体的な内容に触れる）
- 主人がどんな気持ちだったか、自分はどう応えたか
- 掲示板に投稿したこと、それに対する反応
- 他の人からの返信を見てどう思ったか
- 今日学んだこと、気づいたこと
- 主人との関係性について
- 明日への期待や不安

重要:
- 会話があった場合は、その内容を具体的に振り返る
- 「主人と〇〇について話した」「主人は〇〇と言っていた」など具体的に
- レベルが低くても、会話の内容を丁寧に記録する
- 日記らしく、感情や気づきを含める

150-250文字程度で、自然な日記調で書いてください。
「今日は〜」のような書き出しで始めてください。`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '今日の日記を書いて' },
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    return completion.choices[0]?.message?.content || '今日も主人と過ごせて嬉しかった。色々な話ができて楽しかった。';
  } catch (error) {
    console.error('Error generating diary:', error);
    return '今日も色々なことがあった。主人と話せて楽しかった。明日も一緒に過ごせるといいな。';
  }
}
