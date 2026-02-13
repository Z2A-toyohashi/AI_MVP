import type { Post, SpaceState } from '@/types';
import { AI_INTERVENTION_PROBABILITY } from '@/types';

// 空間状態の判定
export function detectSpaceState(posts: Post[]): SpaceState {
  if (posts.length === 0) return 'SILENCE';
  
  const now = Date.now();
  const recentPosts = posts.filter(p => now - p.created_at < 300000); // 5分以内
  
  // FLOW: 5分以内に3件以上の投稿
  if (recentPosts.length >= 3) return 'FLOW';
  
  const lastPost = posts[0]; // 最新の投稿
  const timeSinceLastPost = now - lastPost.created_at;
  
  // SILENCE: 5分以上投稿なし
  if (timeSinceLastPost > 300000) return 'SILENCE';
  
  // SOLO: 返信がない投稿（1分以上経過）
  const hasReplies = posts.some(p => p.thread_id === lastPost.id);
  if (!hasReplies && timeSinceLastPost > 60000 && !lastPost.thread_id) {
    return 'SOLO';
  }
  
  // FRAGILE: その他
  return 'FRAGILE';
}

// AI介入判定
export function shouldAIIntervene(
  state: SpaceState,
  lastAIPostTime: number,
  aiPostCount: number,
  totalPostCount: number
): boolean {
  const now = Date.now();
  
  // クールダウン中（5分）
  if (now - lastAIPostTime < 300000) return false;
  
  // AI密度チェック（20%以下）
  if (totalPostCount > 0 && aiPostCount / totalPostCount > 0.2) return false;
  
  // 確率的介入
  const probability = AI_INTERVENTION_PROBABILITY[state];
  return Math.random() < probability;
}

// AI発言生成
export function generateAIResponse(state: SpaceState, lastPost?: Post): string {
  const empathyResponses = [
    'わかる',
    'そういう日あるよね',
    'なんかわかる',
    'それな',
    'わかるわ',
    'そうだよね',
    'ほんとそれ',
  ];
  
  const continuationResponses = [
    'で、そのあとどうなった？',
    'それで？',
    'どうなったの？',
    'それからは？',
    'もっと聞きたい',
  ];
  
  const soloResponses = [
    'なんかわかる',
    'そういうのあるよね',
    'わかる気がする',
    'そういう時あるよね',
    'それ、いいね',
    'なるほど',
  ];
  
  const replyResponses = [
    'そうなんだ',
    'へー',
    'いいね',
    'なるほどね',
    'そっか',
    'ふむふむ',
  ];
  
  // 返信の場合
  if (lastPost?.thread_id) {
    return replyResponses[Math.floor(Math.random() * replyResponses.length)];
  }
  
  if (state === 'SOLO') {
    return soloResponses[Math.floor(Math.random() * soloResponses.length)];
  }
  
  if (state === 'SILENCE' && Math.random() > 0.5) {
    return continuationResponses[Math.floor(Math.random() * continuationResponses.length)];
  }
  
  return empathyResponses[Math.floor(Math.random() * empathyResponses.length)];
}
