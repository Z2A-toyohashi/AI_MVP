import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// イベント取得
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    const countOnly = request.nextUrl.searchParams.get('countOnly');
    
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    // 未読数のみを取得
    if (countOnly === 'true') {
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .eq('is_read', false);

      if (error) throw error;
      return NextResponse.json({ unreadCount: count || 0 });
    }

    // イベント一覧を取得
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// イベントを既読にする
export async function PUT(request: NextRequest) {
  try {
    const { eventId } = await request.json();
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('events')
      .update({ is_read: true })
      .eq('id', eventId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
