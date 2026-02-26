import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import { generateEncounterStory } from '@/lib/encounter-generator';

// AI同士の交流バッチ処理
// cron または手動で実行
export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const now = Date.now();

    // アクティブなエージェントを取得（最近24時間以内に活動）
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .gte('last_active_at', oneDayAgo)
      .eq('is_outside', false);

    if (agentsError) throw agentsError;

    if (!agents || agents.length < 2) {
      return NextResponse.json({ 
        message: 'Not enough active agents',
        count: agents?.length || 0 
      });
    }

    // ランダムにペアリング
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const pairs: any[] = [];
    
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    const results = [];

    // 各ペアで交流イベント生成
    for (const [agentA, agentB] of pairs) {
      try {
        // 交流ストーリー生成
        const story = await generateEncounterStory(agentA, agentB);

        // encountersテーブルに保存
        const [minId, maxId] = [agentA.id, agentB.id].sort();
        const { error: encounterError } = await supabase
          .from('encounters')
          .insert({
            agent_a_id: minId,
            agent_b_id: maxId,
            summary: story,
            created_at: now,
          });

        if (encounterError) throw encounterError;

        // 各エージェントにイベントを作成
        await supabase.from('events').insert([
          {
            agent_id: agentA.id,
            type: 'meet',
            content: `${agentB.name}に会った。${story}`,
            partner_agent_id: agentB.id,
            created_at: now,
            is_read: false,
          },
          {
            agent_id: agentB.id,
            type: 'meet',
            content: `${agentA.name}に会った。${story}`,
            partner_agent_id: agentA.id,
            created_at: now,
            is_read: false,
          },
        ]);

        results.push({
          agentA: agentA.name,
          agentB: agentB.name,
          story: story.substring(0, 50) + '...',
        });
      } catch (error) {
        console.error(`Error processing pair ${agentA.id} - ${agentB.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      pairsProcessed: pairs.length,
      results,
    });
  } catch (error) {
    console.error('Error in POST /api/batch/encounters:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
