import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// 公園の会話を定期生成するバッチ（Vercel Cron から呼ばれる）
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase();

    // level 5以上のエージェントを取得
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, user_id, name, personality, level, appearance_stage, character_image_url')
      .gte('level', 5)
      .limit(8);

    if (error || !agents || agents.length < 2) {
      return NextResponse.json({ message: 'Not enough agents', count: agents?.length || 0 });
    }

    // 最新5件の投稿を取得
    const { data: posts } = await supabase
      .from('posts')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(5);

    // park/conversation APIを内部呼び出し
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/park/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents, recentPosts: posts || [] }),
    });

    const data = await res.json();
    return NextResponse.json({ success: true, groups: data.groups?.length || 0 });
  } catch (e) {
    console.error('park-conversation batch error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
