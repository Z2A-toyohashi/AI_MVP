import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// エージェント取得・作成
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // エージェントが存在しない場合は作成
    if (!agent) {
      const now = Date.now();
      const { data: newAgent, error: createError } = await supabase
        .from('agents')
        .insert({
          user_id: userId,
          name: 'AI',
          personality: { positive: 0, talkative: 0, curious: 0 },
          level: 1,
          experience: 0,
          appearance_stage: 1,
          last_active_at: now,
          is_outside: false,
          created_at: now,
        })
        .select()
        .single();

      if (createError) throw createError;
      return NextResponse.json(newAgent);
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error in GET /api/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// エージェント更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, ...updates } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
