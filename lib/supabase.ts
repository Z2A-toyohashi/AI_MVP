// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの作成
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// サーバーサイド用（Service Roleキー使用）
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}
