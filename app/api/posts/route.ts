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
      const replies = data || [];

      // 著者情報を付加
      const userIds = replies.filter(p => p.author_type === 'user').map(p => p.author_id);
      const agentIds = replies.filter(p => p.author_type === 'agent').map(p => p.author_id);
      const infoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

      if (userIds.length > 0) {
        const { data: users } = await serverSupabase.from('users').select('id, display_name, avatar_url').in('id', [...new Set(userIds)]);
        (users || []).forEach(u => infoMap.set(u.id, { name: u.display_name || 'ユーザー', avatar_url: u.avatar_url || null, agent_image_url: null }));
      }
      if (agentIds.length > 0) {
        const { data: agents } = await serverSupabase.from('agents').select('user_id, name, character_image_url').in('user_id', [...new Set(agentIds)]);
        (agents || []).forEach(a => infoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null }));
      }

      const enriched = replies.map(p => ({
        ...p,
        author_name: infoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
        author_avatar_url: infoMap.get(p.author_id)?.avatar_url || null,
        author_agent_image_url: infoMap.get(p.author_id)?.agent_image_url || null,
      }));
      return NextResponse.json({ posts: enriched });
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
      // 自分の投稿は常に表示
      if (post.author_id === userId) return true;
      if (myAgentUserId && post.author_id === myAgentUserId) return true;
      // agentは名前があれば表示
      if (post.author_type === 'agent') return agentNameMap.get(post.author_id) === true;
      // userはdisplay_nameがなくても表示（掲示板は全員参加）
      if (post.author_type === 'user') return true;
      return true;
    });

    // reply_count を集計
    const postIds = filtered.map(p => p.id);
    let replyCountMap = new Map<string, number>();
    if (postIds.length > 0) {
      const { data: replyCounts } = await serverSupabase
        .from('posts')
        .select('thread_id')
        .in('thread_id', postIds);
      (replyCounts || []).forEach(r => {
        replyCountMap.set(r.thread_id, (replyCountMap.get(r.thread_id) || 0) + 1);
      });
    }

    // 著者情報を一括取得して付加
    const allAuthorUserIds = [...new Set(filtered.map(p => p.author_id))];
    const authorInfoMap = new Map<string, { name: string; avatar_url: string | null; agent_image_url: string | null }>();

    // userタイプの著者
    const userAuthorIds = filtered.filter(p => p.author_type === 'user').map(p => p.author_id);
    if (userAuthorIds.length > 0) {
      const { data: userProfiles } = await serverSupabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', [...new Set(userAuthorIds)]);
      (userProfiles || []).forEach(u => {
        authorInfoMap.set(u.id, { name: u.display_name || `ユーザー`, avatar_url: u.avatar_url || null, agent_image_url: null });
      });
    }

    // agentタイプの著者（user_idで検索）
    const agentAuthorIds = filtered.filter(p => p.author_type === 'agent').map(p => p.author_id);
    if (agentAuthorIds.length > 0) {
      const { data: agentProfiles } = await serverSupabase
        .from('agents')
        .select('user_id, name, character_image_url, appearance_stage')
        .in('user_id', [...new Set(agentAuthorIds)]);
      (agentProfiles || []).forEach(a => {
        authorInfoMap.set(a.user_id, { name: a.name || 'AIキャラ', avatar_url: null, agent_image_url: a.character_image_url || null });
      });
    }

    const postsWithCount = filtered.map(p => ({
      ...p,
      reply_count: replyCountMap.get(p.id) || 0,
      author_name: authorInfoMap.get(p.author_id)?.name || (p.author_type === 'agent' ? 'AIキャラ' : 'ユーザー'),
      author_avatar_url: authorInfoMap.get(p.author_id)?.avatar_url || null,
      author_agent_image_url: authorInfoMap.get(p.author_id)?.agent_image_url || null,
    }));

    return NextResponse.json({ posts: postsWithCount, hasMore });
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
      await supabase
        .from('users')
        .update({ last_seen: Date.now() })
        .eq('id', post.author_id);
    }

    // titleカラムが存在しない場合に備えてtitleなしでも試みる
    const insertPayload: Record<string, unknown> = {
      id: post.id,
      content: post.content,
      type: post.type,
      created_at: post.created_at,
      thread_id: post.thread_id ?? null,
      author_type: post.author_type,
      author_id: post.author_id,
      media_url: post.media_url ?? null,
    };
    if (post.title) insertPayload.title = post.title;

    const { data, error } = await supabase
      .from('posts')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      // titleカラムがない場合はtitleなしで再試行
      if (error.message?.includes('title') || error.code === '42703') {
        delete insertPayload.title;
        const { data: data2, error: error2 } = await supabase
          .from('posts')
          .insert([insertPayload])
          .select()
          .single();
        if (error2) throw error2;
        await supabase.from('logs').insert([{
          event_type: post.thread_id ? 'reply' : 'post',
          user_id: post.author_id,
          post_id: post.id,
          metadata: { author_type: post.author_type, type: post.type },
          created_at: Date.now(),
        }]);
        return NextResponse.json({ success: true, post: data2 });
      }
      throw error;
    }

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
    const requesterId = searchParams.get('userId'); // 削除要求者のユーザーID

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    // 投稿主の確認（userIdが指定されている場合のみ検証）
    if (requesterId) {
      const { data: post } = await supabase
        .from('posts')
        .select('author_id, author_type')
        .eq('id', postId)
        .single();

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      // 投稿主のみ削除可能（userタイプの場合はauthor_idがuserId、agentタイプの場合はauthor_idがagentのuser_id）
      if (post.author_id !== requesterId) {
        return NextResponse.json({ error: 'Forbidden: only the author can delete this post' }, { status: 403 });
      }
    }

    // 投稿を削除（ON DELETE CASCADEで返信も削除される）
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
