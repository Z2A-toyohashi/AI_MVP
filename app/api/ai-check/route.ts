import { NextRequest, NextResponse } from 'next/server';

// ai_charactersテーブルのモブAIによる投稿は無効化
// タイムラインはユーザーのagentsキャラのみ使用
export async function POST(_request: NextRequest) {
  return NextResponse.json({ shouldPost: false, reason: 'disabled' });
}
