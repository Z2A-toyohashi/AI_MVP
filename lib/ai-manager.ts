import { supabase } from './supabase-client';

interface AICharacter {
  id: string;
  name: string;
  personality: string;
  system_prompt: string;
  created_at: number;
}

// アクティブなAIキャラクターのキャッシュ
let activeAICharacters: AICharacter[] = [];
let lastUpdate = 0;
const CACHE_DURATION = 60000; // 1分

/**
 * 現在のユーザー数に応じてAIキャラクターを取得
 */
export async function getActiveAICharacters(userCount: number): Promise<AICharacter[]> {
  const now = Date.now();
  
  // キャッシュが有効な場合は再利用
  if (activeAICharacters.length > 0 && now - lastUpdate < CACHE_DURATION) {
    return activeAICharacters.slice(0, Math.max(1, Math.floor(userCount * 0.5)));
  }

  try {
    const { data, error } = await supabase
      .from('ai_characters')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    activeAICharacters = data || [];
    lastUpdate = now;

    // ユーザー数の50%程度のAIを返す（最低1人）
    const aiCount = Math.max(1, Math.floor(userCount * 0.5));
    return activeAICharacters.slice(0, aiCount);
  } catch (error) {
    console.error('Failed to fetch AI characters:', error);
    return [];
  }
}

/**
 * ランダムにAIキャラクターを1人選択
 */
export async function selectRandomAICharacter(userCount: number): Promise<AICharacter | null> {
  const characters = await getActiveAICharacters(userCount);
  if (characters.length === 0) return null;
  
  return characters[Math.floor(Math.random() * characters.length)];
}

/**
 * 特定のAIキャラクターを取得
 */
export async function getAICharacter(aiId: string): Promise<AICharacter | null> {
  try {
    const { data, error } = await supabase
      .from('ai_characters')
      .select('*')
      .eq('id', aiId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch AI character:', error);
    return null;
  }
}

/**
 * AIキャラクターがリアクションする確率を判定
 */
export function shouldAIReact(spaceState: string): boolean {
  const probabilities: Record<string, number> = {
    FLOW: 0.1,
    SILENCE: 0.3,
    FRAGILE: 0.2,
    SOLO: 0.4,
  };
  
  return Math.random() < (probabilities[spaceState] || 0.2);
}

/**
 * ランダムに絵文字を選択
 */
export function selectRandomEmoji(): string {
  const emojis = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}
