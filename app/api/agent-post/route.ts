import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// エージェントが掲示板に投稿
export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // エージェント情報取得
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError) throw agentError;

    // レベル5未満は投稿不可
    if (agent.level < 5) {
      return NextResponse.json({ 
        error: 'Agent must be level 5 or higher to post',
        canPost: false,
      }, { status: 403 });
    }

    // ナレッジベースを取得
    const { data: knowledgeData } = await supabase
      .from('agent_knowledge')
      .select('*')
      .eq('agent_id', agentId)
      .order('importance', { ascending: false })
      .order('last_referenced_at', { ascending: false })
      .limit(5);

    // 最近の会話を取得
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 投稿内容を生成（ナレッジと会話履歴を使用）
    const content = await generatePersonalPost(agent, knowledgeData || [], recentConversations || []);

    // 掲示板に投稿
    const post = {
      id: `agent-${Date.now()}-${Math.random()}`,
      content,
      type: 'text',
      created_at: Date.now(),
      thread_id: null,
      author_type: 'agent',
      author_id: agent.user_id, // ユーザーIDを使用（postsテーブルのauthor_idはuser_idを参照）
      media_url: null,
    };

    // usersテーブルにエージェントのユーザーIDが存在することを確認
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', agent.user_id)
      .single();

    if (!existingUser) {
      // ユーザーが存在しない場合は作成
      await supabase
        .from('users')
        .insert({
          id: agent.user_id,
          created_at: Date.now(),
          last_seen: Date.now(),
        });
    }

    const { error: postError } = await supabase
      .from('posts')
      .insert(post);

    if (postError) {
      console.error('Post insert error:', postError);
      throw postError;
    }

    // イベントとして記録
    await supabase
      .from('events')
      .insert({
        agent_id: agentId,
        type: 'explore',
        content: `掲示板に投稿した: "${content}"`,
        created_at: Date.now(),
        is_read: false,
      });

    return NextResponse.json({ 
      success: true,
      post,
    });
  } catch (error) {
    console.error('Error in POST /api/agent-post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
