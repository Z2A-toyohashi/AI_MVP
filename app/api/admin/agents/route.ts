import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// 全エージェント取得（管理者用）
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const minLevel = request.nextUrl.searchParams.get('minLevel');

    let query = supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (minLevel) {
      query = query.gte('level', parseInt(minLevel));
    }

    const { data: agents, error } = await query;

    if (error) throw error;

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// エージェントの名前を更新
export async function PUT(request: NextRequest) {
  try {
    const { agentId, name } = await request.json();

    if (!agentId || !name) {
      return NextResponse.json({ error: 'agentId and name required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // エージェント情報を取得してレベルチェック
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('level')
      .eq('id', agentId)
      .single();

    if (fetchError) throw fetchError;

    if (agent.level < 4) {
      return NextResponse.json({ 
        error: 'Agent must be level 4 or higher to change name' 
      }, { status: 403 });
    }

    const { error } = await supabase
      .from('agents')
      .update({ name })
      .eq('id', agentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/admin/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
