import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import { generateAIResponse } from '@/lib/agent-chat';

// エージェントがSNSに投稿
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
        error: 'Agent must be level 5 or higher to post to SNS',
        canPost: false,
      }, { status: 403 });
    }

    // 最近の投稿を取得してコンテキストを作る
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // 投稿内容を生成
    const context = recentPosts && recentPosts.length > 0
      ? `最近の投稿: ${recentPosts.map(p => p.content).join(', ')}`
      : '新しい話題を始めよう';

    const prompt = `あなたは匿名SNS「空間」に投稿します。${context}。短く自然な投稿を1つ作ってください（30文字以内）。`;
    const content = await generateAIResponse(agent, prompt);

    // SNSに投稿
    const post = {
      id: `agent-${Date.now()}-${Math.random()}`,
      content,
      type: 'text',
      created_at: Date.now(),
      thread_id: null,
      author_type: 'agent',
      author_id: agentId,
      media_url: null, // 投稿内容には画像を含めない
    };

    await supabase
      .from('posts')
      .insert(post);

    // イベントとして記録
    await supabase
      .from('events')
      .insert({
        agent_id: agentId,
        type: 'explore',
        content: `SNS「空間」に投稿した: "${content}"`,
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
