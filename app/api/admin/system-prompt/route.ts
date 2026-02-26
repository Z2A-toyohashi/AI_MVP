import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';

// グローバルシステムプロンプト取得
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    
    const { data, error } = await supabase
      .from('agent_system_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      system_prompt: data?.system_prompt || '',
      updated_at: data?.updated_at || Date.now(),
    });
  } catch (error) {
    console.error('Error in GET /api/admin/system-prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// グローバルシステムプロンプト更新
export async function PUT(request: NextRequest) {
  try {
    const { system_prompt } = await request.json();

    if (!system_prompt) {
      return NextResponse.json({ error: 'system_prompt required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    const { error } = await supabase
      .from('agent_system_settings')
      .update({ 
        system_prompt,
        updated_at: now,
      })
      .eq('id', 'default');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/admin/system-prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
