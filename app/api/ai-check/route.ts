import { NextRequest, NextResponse } from 'next/server';
import type { Post } from '@/types';
import { detectSpaceState, shouldAIIntervene } from '@/lib/ai-logic';
import { generateAIResponseWithGPT } from '@/lib/gpt';
import { supabase } from '@/lib/supabase-client';

let lastAIPostTime = 0;

export async function POST(request: NextRequest) {
  try {
    const { posts }: { posts: Post[] } = await request.json();
    
    // AI設定を取得
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    const config = settings || {
      cooldown_min: 300000,
      cooldown_max: 900000,
      max_ai_density: 0.2,
      prob_flow: 0.0,
      prob_silence: 0.35,
      prob_fragile: 0.15,
      prob_solo: 0.5,
      system_prompt: 'あなたは自然な会話口調で短く返信してください。',
    };

    const aiPosts = posts.filter(p => p.author_type === 'ai');
    const state = detectSpaceState(posts);
    
    // クールダウンチェック（設定値を使用）
    const now = Date.now();
    const cooldownTime = config.cooldown_min + Math.random() * (config.cooldown_max - config.cooldown_min);
    if (now - lastAIPostTime < cooldownTime) {
      return NextResponse.json({ shouldPost: false });
    }

    // AI密度チェック（設定値を使用）
    if (posts.length > 0 && aiPosts.length / posts.length > config.max_ai_density) {
      return NextResponse.json({ shouldPost: false });
    }

    // 確率的介入（設定値を使用）
    const probabilities: Record<string, number> = {
      FLOW: config.prob_flow,
      SILENCE: config.prob_silence,
      FRAGILE: config.prob_fragile,
      SOLO: config.prob_solo,
    };
    
    const probability = probabilities[state] || 0;
    if (Math.random() >= probability) {
      return NextResponse.json({ shouldPost: false });
    }

    const lastPost = posts[0];
    
    // 返信先を決定
    let thread_id = null;
    let targetPost = undefined;
    
    if (state === 'SOLO') {
      thread_id = lastPost?.id;
      targetPost = lastPost;
    } else if (state === 'FRAGILE' && Math.random() < 0.3) {
      thread_id = lastPost?.id;
      targetPost = lastPost;
    } else if (state === 'SILENCE' && Math.random() < 0.2) {
      thread_id = lastPost?.id;
      targetPost = lastPost;
    }

    // GPTで応答を生成（画像がある場合はVision APIを使用）
    const content = await generateAIResponseWithGPT(config.system_prompt, posts, targetPost);
    
    lastAIPostTime = Date.now();

    // AI介入ログを記録
    await supabase.from('logs').insert([{
      event_type: 'ai_intervention',
      user_id: 'system',
      post_id: lastPost?.id || null,
      metadata: { 
        state, 
        content, 
        is_reply: !!thread_id, 
        used_gpt: true,
        has_image: !!targetPost?.media_url,
        probability,
      },
      created_at: Date.now(),
    }]);

    return NextResponse.json({
      shouldPost: true,
      content,
      thread_id,
    });
  } catch (error) {
    console.error('AI check error:', error);
    return NextResponse.json({ shouldPost: false });
  }
}
