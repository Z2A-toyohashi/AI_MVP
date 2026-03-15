// 投稿の型定義
export interface Post {
  id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  created_at: number;
  thread_id: string | null;
  author_type: 'user' | 'ai' | 'agent';
  author_id: string;
  media_url: string | null;
  title?: string | null;
  source_tag?: string | null;
  reply_count?: number;
  author_name?: string;
  author_avatar_url?: string | null;
  author_agent_image_url?: string | null;
  expires_at?: number | null;
  is_archived?: boolean;
  summary?: string | null;
  heat_score?: number;
}

// ログの型定義
export interface Log {
  id: string;
  event_type: 'post' | 'view' | 'reply' | 'ai_intervention';
  user_id: string;
  post_id: string | null;
  metadata: Record<string, any> | null;
  created_at: number;
}

// 空間状態の型定義
export type SpaceState = 'FLOW' | 'SILENCE' | 'FRAGILE' | 'SOLO';

// AI介入確率
export const AI_INTERVENTION_PROBABILITY: Record<SpaceState, number> = {
  FLOW: 0,
  SILENCE: 0.35,
  FRAGILE: 0.15,
  SOLO: 0.5,
};

// ユーザーカラー（17色）
export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  '#E63946', '#A8DADC', '#F4A261', '#2A9D8F', '#E76F51',
  '#8338EC', '#FB5607',
];
