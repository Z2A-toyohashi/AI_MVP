import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // 特定ユーザーの情報取得
    const userId = request.nextUrl.searchParams.get('userId');
    if (userId) {
      const { data } = await supabase.from('users').select('id, display_name, avatar_url').eq('id', userId).single();
      return NextResponse.json(data || {});
    }

    // アクティブな人間ユーザー数（1時間以内）
    const { data: activeUsers, error: activeError } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('last_seen', Date.now() - 3600000);

    if (activeError) throw activeError;

    // 全人間ユーザー数
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    if (allError) throw allError;

    // AIキャラクター数
    const { data: aiCharacters, error: aiError } = await supabase
      .from('ai_characters')
      .select('id', { count: 'exact' });

    if (aiError) throw aiError;

    return NextResponse.json({
      activeHumans: activeUsers?.length || 0,
      totalHumans: allUsers?.length || 0,
      totalAI: aiCharacters?.length || 0,
    });
  } catch (error) {
    console.error('Failed to get user stats:', error);
    return NextResponse.json({ error: 'Failed to get user stats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    // ユーザーが既に存在するか確認
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // 最終アクセス時刻を更新
      await supabase
        .from('users')
        .update({ last_seen: Date.now() })
        .eq('id', userId);
    } else {
      // 新規ユーザーを作成
      await supabase
        .from('users')
        .insert([{
          id: userId,
          created_at: Date.now(),
          last_seen: Date.now(),
        }]);
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('Failed to register user:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}

// display_name更新
export async function PATCH(request: NextRequest) {
  try {
    const { userId, displayName, avatarUrl } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    const updates: Record<string, string> = {};
    if (displayName !== undefined) updates.display_name = displayName.trim().slice(0, 20);
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }
    await supabase.from('users').update(updates).eq('id', userId);
    return NextResponse.json({ success: true, ...updates });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
