// app/api/setup-db/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // recordsテーブルを作成
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(10) NOT NULL CHECK (type IN ('audio', 'image', 'video')),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          transcript TEXT,
          ai_response TEXT,
          prompt TEXT,
          media_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
        CREATE INDEX IF NOT EXISTS idx_records_timestamp ON records(timestamp DESC);

        ALTER TABLE records ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Enable read access for all users" ON records;
        CREATE POLICY "Enable read access for all users" ON records
          FOR SELECT USING (true);

        DROP POLICY IF EXISTS "Enable insert access for all users" ON records;
        CREATE POLICY "Enable insert access for all users" ON records
          FOR INSERT WITH CHECK (true);

        DROP POLICY IF EXISTS "Enable delete access for all users" ON records;
        CREATE POLICY "Enable delete access for all users" ON records
          FOR DELETE USING (true);
      `
    });

    if (tableError) {
      console.error('Table creation error:', tableError);
      return NextResponse.json(
        { 
          error: 'テーブル作成に失敗しました。Supabase Dashboardで手動で作成してください。',
          details: tableError.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'データベースのセットアップが完了しました' 
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { 
        error: 'セットアップに失敗しました。Supabase Dashboardで手動で作成してください。',
        details: error.message,
        instruction: 'Supabase Dashboard → SQL Editor で supabase-schema.sql を実行してください'
      },
      { status: 500 }
    );
  }
}
