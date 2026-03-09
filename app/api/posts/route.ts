import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { getServerSupabase } from '@/lib/supabase-client';
import type { Post } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = getServerSupabase();
    const userId = request.nextUrl.searchParams.get('userId');

    const { data, error } = await serverSupabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const posts = data || [];

    // 名前・表示名のない匿名投稿をフィルタリング
    // agent投稿: agentsテーブルにnameが存在するか確認
    // user投稿: usersテーブルにdisplay_nameが存在するか確認
    // 自分のエージェント投稿は常に含める
    const agentIds = [...new Set(posts.filter(p => p.author_type === 'agent').map(p => p.author_id))];
    const userIds = [...new Set(posts.filter(p => p.author_type === 'user').map(p => p.author_id))];

    // エージェント名を一括取得
    const agentNameMap = new Map<string, boolean>();
    if (agentIds.length > 0) {
      const { data: agents } = await serverSupabase
        .from('agents')
        .select('user_id, name')
        .in('user_id', agentIds);
      (agents || []).forEach(a => agentNameMap.set(a.user_id, !!a.name));
    }

    // ユーザー表示名を一括取得
    const userNameMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: users } = await serverSupabase
        .from('users')
        .select('id, display_name')
        .in('id', userIds);
      (users || []).forEach(u => userNameMap.set(u.id, !!u.display_name));
    }

    // 自分のエージェントのuser_idを取得
    let myAgentUserId: string | null = null;
    if (userId) {
      const { data: myAgent } = await serverSupabase
        .from('agents')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      myAgentUserId = myAgent?.user_id || null;
    }

    const filtered = posts.filter(post => {
      // ai_charactersテーブル由来のモブAI投稿は除外（author_type === 'ai'）
      if (post.author_type === 'ai') return false;
      // 自分のエージェント投稿は常に含める
      if (myAgentUserId && post.author_id === myAgentUserId) return true;
      if (post.author_type === 'agent') return agentNameMap.get(post.author_id) === true;
      if (post.author_type === 'user') return userNameMap.get(post.author_id) === true;
      return true;
    });

    return NextResponse.json({ posts: filtered });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ posts: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const post: Post = await request.json();

    // ユーザーが存在しない場合は自動作成
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', post.author_id)
      .single();

    if (!existingUser) {
      await supabase
        .from('users')
        .insert([{
          id: post.author_id,
          created_at: Date.now(),
          last_seen: Date.now(),
        }]);
    } else {
      // 最終アクセス時刻を更新
      await supabase
        .from('users')
        .update({ last_seen: Date.now() })
        .eq('id', post.author_id);
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([post])
      .select()
      .single();

    if (error) throw error;

    // ログを記録
    await supabase.from('logs').insert([{
      event_type: post.thread_id ? 'reply' : 'post',
      user_id: post.author_id,
      post_id: post.id,
      metadata: { author_type: post.author_type, type: post.type },
      created_at: Date.now(),
    }]);

    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error('Failed to create post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    // 投稿を削除（返信も一緒に削除される場合はカスケード設定が必要）
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;

    // ログを記録
    await supabase.from('logs').insert([{
      event_type: 'post',
      user_id: 'system',
      post_id: postId,
      metadata: { action: 'delete' },
      created_at: Date.now(),
    }]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
