import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import { generateAIResponse } from '@/lib/agent-chat';

// 会話履歴取得
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 会話送信（ユーザー → AI）
export async function POST(request: NextRequest) {
  try {
    const { agentId, content } = await request.json();

    if (!agentId || !content) {
      return NextResponse.json({ error: 'agentId and content required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    // ユーザーメッセージを保存
    const { error: userError } = await supabase
      .from('conversations')
      .insert({
        agent_id: agentId,
        role: 'user',
        content,
        created_at: now,
      });

    if (userError) throw userError;

    // エージェント情報取得
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError) throw agentError;

    // AI応答生成
    const aiResponse = await generateAIResponse(agent, content);

    // AI応答を保存
    const { error: aiError } = await supabase
      .from('conversations')
      .insert({
        agent_id: agentId,
        role: 'ai',
        content: aiResponse,
        created_at: Date.now(),
      });

    if (aiError) throw aiError;

    // エージェントの性格と経験値を更新
    const updates = await updateAgentProgress(supabase, agentId, agent, content);

    return NextResponse.json({ 
      response: aiResponse,
      levelUp: updates.levelUp,
      newLevel: updates.newLevel,
      newStage: updates.newStage,
    });
  } catch (error) {
    console.error('Error in POST /api/conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// エージェントの進化ロジック
async function updateAgentProgress(supabase: any, agentId: string, agent: any, content: string) {
  const newPersonality = { ...agent.personality };
  
  // 8次元の性格パラメータを初期化
  if (!newPersonality.creative) newPersonality.creative = 0;
  if (!newPersonality.logical) newPersonality.logical = 0;
  if (!newPersonality.emotional) newPersonality.emotional = 0;
  if (!newPersonality.adventurous) newPersonality.adventurous = 0;
  if (!newPersonality.cautious) newPersonality.cautious = 0;
  
  let experience = agent.experience || 0;
  let level = agent.level || 1;
  let appearanceStage = agent.appearance_stage || 1;
  
  // 経験値を追加（会話1回につき20〜50ポイント - プロトタイプ用に多め）
  const expGain = Math.floor(20 + content.length / 3);
  experience += Math.min(expGain, 50);
  
  // レベルアップ判定（プロトタイプ用に簡単）
  let levelUp = false;
  const expNeeded = level * 30; // レベル1: 30, レベル2: 60, レベル3: 90...
  
  if (experience >= expNeeded) {
    const oldLevel = level;
    level += 1;
    experience = experience - expNeeded;
    levelUp = true;
    
    // 見た目の進化（5段階）
    const oldStage = appearanceStage;
    if (level >= 9) appearanceStage = 5;
    else if (level >= 7) appearanceStage = 4;
    else if (level >= 5) appearanceStage = 3;
    else if (level >= 3) appearanceStage = 2;
    else appearanceStage = 1;
    
    // 見た目が変わった場合、画像を生成
    if (appearanceStage > oldStage) {
      // 非同期で画像生成（レスポンスを待たない）
      generateCharacterImage(supabase, agentId, newPersonality, appearanceStage).catch(err => {
        console.error('Failed to generate character image:', err);
      });
    }
  }
  
  // 性格パラメータの更新（8次元）
  
  // ネガティブワード検出
  const negativeWords = ['悲しい', '辛い', '嫌', '疲れた', 'つらい', '寂しい', '不安'];
  const hasNegative = negativeWords.some(word => content.includes(word));
  if (hasNegative) {
    newPersonality.positive = Math.max(-10, (newPersonality.positive || 0) - 1);
    newPersonality.emotional = Math.min(10, (newPersonality.emotional || 0) + 0.5);
  } else {
    newPersonality.positive = Math.min(10, (newPersonality.positive || 0) + 0.5);
  }

  // 会話量で「おしゃべり度」を更新
  if (content.length > 50) {
    newPersonality.talkative = Math.min(10, (newPersonality.talkative || 0) + 1);
  }

  // 質問があれば「好奇心」を更新
  if (content.includes('?') || content.includes('？')) {
    newPersonality.curious = Math.min(10, (newPersonality.curious || 0) + 1);
  }
  
  // 創造性（比喩や想像的な表現）
  const creativeWords = ['みたい', 'ような', 'もし', '想像', 'アイデア', '面白い'];
  if (creativeWords.some(word => content.includes(word))) {
    newPersonality.creative = Math.min(10, (newPersonality.creative || 0) + 0.5);
  }
  
  // 論理性（理由や説明）
  const logicalWords = ['なぜ', 'だから', 'なので', '理由', '説明', 'つまり'];
  if (logicalWords.some(word => content.includes(word))) {
    newPersonality.logical = Math.min(10, (newPersonality.logical || 0) + 0.5);
  }
  
  // 冒険心（新しいことへの興味）
  const adventurousWords = ['やってみたい', '試したい', '挑戦', '新しい', '行きたい'];
  if (adventurousWords.some(word => content.includes(word))) {
    newPersonality.adventurous = Math.min(10, (newPersonality.adventurous || 0) + 0.5);
  }
  
  // 慎重さ（心配や確認）
  const cautiousWords = ['大丈夫', '心配', '確認', '注意', '気をつけ'];
  if (cautiousWords.some(word => content.includes(word))) {
    newPersonality.cautious = Math.min(10, (newPersonality.cautious || 0) + 0.5);
  }

  // 会話からナレッジを抽出（5回に1回）
  const conversationCount = await getConversationCount(supabase, agentId);
  if (conversationCount % 5 === 0) {
    extractKnowledge(supabase, agentId, content).catch(err => {
      console.error('Failed to extract knowledge:', err);
    });
  }

  // 更新を保存
  const updates: any = { 
    personality: newPersonality,
    experience,
    level,
    appearance_stage: appearanceStage,
    last_active_at: Date.now(),
  };

  // レベル5以上で掲示板投稿可能
  if (level >= 5) {
    updates.can_post_to_sns = true;
  }

  await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId);

  return {
    levelUp,
    newLevel: level,
    newStage: appearanceStage,
    canPostToSns: level >= 5,
  };
}

// 会話数を取得
async function getConversationCount(supabase: any, agentId: string): Promise<number> {
  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);
  return count || 0;
}

// 会話からナレッジを抽出
async function extractKnowledge(supabase: any, agentId: string, userMessage: string) {
  try {
    // 最近の会話を取得
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentConversations || recentConversations.length < 3) return;

    // GPTで会話を要約してトピックを抽出
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const conversationText = recentConversations
      .reverse()
      .map(c => `${c.role}: ${c.content}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `会話から重要なトピックと要約を抽出してください。
JSON形式で返してください: {"topic": "トピック名", "summary": "要約（50文字以内）", "importance": 1-5}
ユーザーの好み、興味、考え方、日常について話した内容を重視してください。`
        },
        { role: 'user', content: conversationText }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) return;

    const knowledge = JSON.parse(result);
    
    // ナレッジを保存
    await supabase
      .from('agent_knowledge')
      .insert({
        agent_id: agentId,
        topic: knowledge.topic,
        summary: knowledge.summary,
        importance: knowledge.importance || 3,
        created_at: Date.now(),
        last_referenced_at: Date.now(),
      });

    console.log('Knowledge extracted:', knowledge);
  } catch (error) {
    console.error('Error extracting knowledge:', error);
  }
}

// キャラクター画像生成
async function generateCharacterImage(supabase: any, agentId: string, personality: any, stage: number) {
  try {
    const { positive = 0, talkative = 0, curious = 0 } = personality;
    
    // 性格に基づいたプロンプト生成
    let mood = 'neutral';
    if (positive > 5) mood = 'cheerful and happy';
    else if (positive < -5) mood = 'sad and gloomy';
    
    let energy = 'calm';
    if (talkative > 5) energy = 'energetic and expressive';
    else if (talkative < -5) energy = 'quiet and reserved';
    
    let trait = '';
    if (curious > 5) trait = ', with curious and wondering eyes';
    
    // 進化段階に応じた見た目
    const stageDescriptions = [
      'a tiny cute blob creature',
      'a small cute creature starting to take shape',
      'a cute creature with defined features',
      'a well-formed cute creature with personality',
      'a fully developed unique cute creature with strong character'
    ];
    
    const prompt = `A cute kawaii character, ${stageDescriptions[stage - 1]}, ${mood}, ${energy}${trait}. Simple flat design, pastel colors, completely transparent background, PNG format, no shadows, no background elements, centered composition, isolated character only, full body visible, clean edges.`;
    
    console.log('Generating character image with prompt:', prompt);
    
    // DALL-E 3で画像生成
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural', // naturalスタイルでよりシンプルに
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned');

    // 画像をダウンロード
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Supabase Storageにアップロード
    const fileName = `agent-${agentId}-stage${stage}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // エージェントに画像URLを保存
    await supabase
      .from('agents')
      .update({ 
        character_image_url: publicUrl,
      })
      .eq('id', agentId);

    console.log('Character image generated and saved:', publicUrl);
  } catch (error) {
    console.error('Error generating character image:', error);
    throw error;
  }
}
