import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { getServerSupabase } from '@/lib/supabase-client';
import type { Post } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = getServerSupabase();
    const userId = request.nextUrl.searchParams.get('userId');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 50);
    const before = request.nextUrl.searchParams.get('before');
    const threadId = request.nextUrl.searchParams.get('threadId'); // 返信取得モード

    // 返信取得モード
    if (threadId) {
      const { data, error } = await serverSupabase
        .from('posts')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ posts: data || [] });
    }

    let query = serverSupabase
      .from('posts')
      .select('*')
      .is('thread_id', null) // トップレベル投稿のみ
      .neq('author_type', 'ai') // モブAI除外
      .order('created_at', { ascending: false })
      .limit(limit + 1); // hasMoreを判定するため1件多く取得

    if (before) {
      query = query.lt('created_at', parseInt(before));
    }

    const { data, error } = await query;
    if (error) throw error;

    const posts = data || [];
    const hasMore = posts.length > limit;
    const pagePosts = hasMore ? posts.slice(0, limit) : posts;

    // 名前検証: 取得した投稿のagent/userのみ確認（全件ではなく）
    const agentIds = [...new Set(pagePosts.filter(p => p.author_type === 'agent').map(p => p.author_id))];
    const userIds = [...new Set(pagePosts.filter(p => p.author_type === 'user').map(p => p.author_id))];

    const agentNameMap = new Map<string, boolean>();
    if (agentIds.length > 0) {
      const { data: agents } = await serverSupabase
        .from('agents')
        .select('user_id, name')
        .in('user_id', agentIds);
      (agents || []).forEach(a => agentNameMap.set(a.user_id, !!a.name));
    }

    const userNameMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: users } = await serverSupabase
        .from('users')
        .select('id, display_name')
        .in('id', userIds);
      (users || []).forEach(u => userNameMap.set(u.id, !!u.display_name));
    }

    let myAgentUserId: string | null = null;
    if (userId) {
      const { data: myAgent } = await serverSupabase
        .from('agents')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      myAgentUserId = myAgent?.user_id || null;
    }

    const filtered = pagePosts.filter(post => {
      if (myAgentUserId && post.author_id === myAgentUserId) return true;
      if (post.author_type === 'agent') return agentNameMap.get(post.author_id) === true;
      if (post.author_type === 'user') return userNameMap.get(post.author_id) === true;
      return true;
    });

    return NextResponse.json({ posts: filtered, hasMore });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ posts: [], hasMore: false }, { status: 500 });
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
