// lib/settings.ts
// AI Living Lab 用の OpenAI API キー保存ユーティリティ

// localStorage に保存するキー名
const OPENAI_API_KEY_STORAGE = 'ai_living_lab_openai_api_key';

// APIキーを保存
export function saveOpenAIApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(OPENAI_API_KEY_STORAGE, apiKey);
  }
}

// APIキーを取得
export function getOpenAIApiKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(OPENAI_API_KEY_STORAGE);
  }
  return null;
}

// APIキーが存在するかどうか
export function hasOpenAIApiKey(): boolean {
  return !!getOpenAIApiKey();
}

// APIキーを削除
export function clearOpenAIApiKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE);
  }
}
