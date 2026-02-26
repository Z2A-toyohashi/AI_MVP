import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// 全エージェント取得（管理者用）
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
