import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('agent_evolution_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true });

    if (error) {
      // テーブルが存在しない場合は空配列を返す
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}
