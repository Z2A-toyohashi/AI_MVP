import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-client';
import { generateAIResponse } from '@/lib/agent-chat';

// API Routeのbodyサイズ制限を10MBに拡張（画像Base64送信のため）
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getTodayStartJST(now: number): number {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst.getTime() - 9 * 60 * 60 * 1000;
}

// 会話履歴取得
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 未読カウントモード
    if (request.nextUrl.searchParams.get('unreadCount') === 'true') {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .in('role', ['ai', 'assistant'])
        .eq('is_read', false);
      return NextResponse.json({ unreadCount: count || 0 });
    }
    // 最新100件を降順で取得してから昇順に並び替え（最新が一番下に来るように）
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    // 古い順に並び替えて返す
    const sorted = (data || []).reverse();
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Error in GET /api/conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 会話送信（ユーザー → AI）
export async function POST(request: NextRequest) {
  try {
    const { agentId, content, isGreeting, imageBase64, imageUrl } = await request.json();

    if (!agentId || !content) {
      return NextResponse.json({ error: 'agentId and content required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const now = Date.now();

    // エージェント情報取得
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError) {
      console.error('Agent fetch error:', agentError);
      return NextResponse.json({ error: 'Agent not found', details: agentError.message, code: agentError.code }, { status: 404 });
    }

    // グリーティングモード: ユーザーメッセージは保存せず、AIから話しかける
    if (isGreeting) {
      // 今日（JST）すでにAIから話しかけていれば何もしない（role='ai'と'assistant'両方チェック）
      const todayStart = getTodayStartJST(now);
      const { count: todayAiCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .in('role', ['ai', 'assistant'])
        .gte('created_at', todayStart);

      if ((todayAiCount || 0) > 0) {
        return NextResponse.json({ skipped: true });
      }

      // 最近の会話を取得してコンテキストに使う
      const { data: recentHistory } = await supabase
        .from('conversations')
        .select('role, content, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      const level = agent.level || 1;
      const isFirstTime = !recentHistory || recentHistory.length === 0;

      if (isFirstTime) {
        // 初回: シンプルな自己紹介
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: `あなたは「${agent.name}」。ユーザーが初めてアプリを開いた。自分から話しかけてください。1〜2文、フレンドリーに、絵文字なし。` }],
          temperature: 1.0,
          max_tokens: 80,
        });
        const greeting = completion.choices[0]?.message?.content || 'はじめまして。';
        await supabase.from('conversations').insert({ agent_id: agentId, role: 'ai', content: greeting, created_at: now });
        return NextResponse.json({ response: greeting });
      }

      // 再訪: 過去の会話を踏まえた文脈のある挨拶
      const historyText = recentHistory && recentHistory.length > 0
        ? recentHistory.reverse().map((m: any) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`).join('\n')
        : '';

      // 理解度に応じた挨拶スタイル
      let greetingStyle = '';
      if (level <= 2) {
        greetingStyle = '丁寧語で、当たり障りなく。「また来てくれたんですね」程度。';
      } else if (level <= 4) {
        greetingStyle = '少し打ち解けた口調で。前回の会話の話題に軽く触れる。「昨日〜って話してたけど」のように。';
      } else if (level <= 6) {
        greetingStyle = 'タメ口で。前回の会話の具体的な内容を引用して話しかける。「あの話、まだ気になってる」「〜ってどうなった？」のように。';
      } else {
        greetingStyle = '完全にタメ口・親友口調。相手の状態を見透かすように話しかける。「なんか今日しんどそう」「また考えすぎてる？」のように。';
      }

      const greetingPrompt = `あなたは「${agent.name}」。ユーザーの第二の自分のような存在。
今日初めてユーザーが戻ってきた。自分から話しかけてください。

過去の会話:
${historyText}

話しかけ方: ${greetingStyle}

ルール:
- 1〜2文のみ
- 絵文字なし
- 「おはよう」「こんにちは」などの定型挨拶は使わない
- 過去の会話の文脈を活かして、"継続して見ている存在"として話しかける
- 具体的な話題・感情・出来事に触れる`;

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: greetingPrompt }],
        temperature: 1.1,
        max_tokens: 100,
      });
      const greeting = completion.choices[0]?.message?.content || 'また来てくれたんだね。';
      await supabase.from('conversations').insert({ agent_id: agentId, role: 'ai', content: greeting, created_at: now });
      return NextResponse.json({ response: greeting });
    }

    // ユーザーメッセージを保存（画像URLがある場合はcontentに埋め込む）
    let savedContent = content;
    if (imageUrl) {
      savedContent = content ? `${content}\n[IMAGE:${imageUrl}]` : `[IMAGE:${imageUrl}]`;
    } else if (imageBase64) {
      // フォールバック: Base64をStorageにアップロード
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = imageBase64.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
        const filename = `chat-${agentId}-${now}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filename, buffer, { contentType: `image/${ext}`, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filename);
          savedContent = content ? `${content}\n[IMAGE:${urlData.publicUrl}]` : `[IMAGE:${urlData.publicUrl}]`;
        }
      } catch (e) {
        console.error('Image upload failed, saving text only:', e);
      }
    }

    const { error: userError } = await supabase
      .from('conversations')
      .insert({
        agent_id: agentId,
        role: 'user',
        content: savedContent,
        created_at: now,
      });

    if (userError) {
      console.error('Failed to save user message:', userError);
      return NextResponse.json({ error: 'Failed to save message', details: userError.message }, { status: 500 });
    }

    // 会話履歴を取得（直近20件、古い順）
    const { data: history } = await supabase
      .from('conversations')
      .select('role, content')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);

    const orderedHistory = (history || []).reverse();

    // AI応答生成（履歴付き）- imageUrlがあればURLで、なければBase64で渡す
    const imageForAI = imageUrl || imageBase64 || undefined;
    const aiResponse = await generateAIResponse(agent, content, orderedHistory, imageForAI);

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

    // レベルアップ判定だけ先に同期で行う（UIに即反映するため）
    const expGain = Math.min(Math.floor(30 + content.length / 2), 80);
    const newExp = (agent.experience || 0) + expGain;
    const currentLevel = agent.level || 1;
    const expNeeded = 50; // 全レベル固定50XP（5〜8回の会話でLv.5到達）
    let levelUpResult = { levelUp: false, newLevel: currentLevel, newStage: agent.appearance_stage || 1 };

    if (newExp >= expNeeded) {
      const newLevel = currentLevel + 1;
      const newStage = newLevel >= 9 ? 5 : newLevel >= 7 ? 4 : newLevel >= 5 ? 3 : newLevel >= 3 ? 2 : 1;
      levelUpResult = { levelUp: true, newLevel, newStage };
    }

    // DB更新・画像生成・ナレッジ抽出はレスポンス後に非同期実行（タイムアウト対策）
    after(async () => {
      try {
        await updateAgentProgress(supabase, agentId, agent, content);
      } catch (e) {
        console.error('updateAgentProgress error:', e);
      }
    });

    return NextResponse.json({ 
      response: aiResponse,
      levelUp: levelUpResult.levelUp,
      newLevel: levelUpResult.newLevel,
      newStage: levelUpResult.newStage,
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
  
  // 経験値を追加
  const expGain = Math.min(Math.floor(30 + content.length / 2), 80);
  experience += expGain;
  
  // レベルアップ判定（全レベル固定50XP）
  let levelUp = false;
  const expNeeded = 50;
  
  if (experience >= expNeeded) {
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

    // 進化の軌跡に記録
    const stageEmojis = ['🥚','🐣','🐥','🐤','🦜'];
    const stageLabel = stageEmojis[appearanceStage - 1] || '🥚';
    supabase.from('agent_evolution_history').insert({
      agent_id: agentId,
      level,
      appearance_stage: appearanceStage,
      stage_label: stageLabel,
      evolved: appearanceStage > oldStage,
      created_at: Date.now(),
    }).then(() => {}).catch(() => {});
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
async function extractKnowledge(supabase: any, agentId: string, _userMessage: string) {
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
      .map((c: any) => `${c.role}: ${c.content}`)
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
    const { positive = 0, talkative = 0, curious = 0, creative = 0, emotional = 0, adventurous = 0 } = personality;

    // 性格スコアから詳細な特徴を構築
    const traits: string[] = [];

    // ムード
    if (positive > 5) traits.push('bright cheerful expression, warm smile');
    else if (positive < -3) traits.push('melancholic gentle expression');
    else traits.push('calm neutral expression');

    // エネルギー
    if (talkative > 5) traits.push('dynamic energetic pose, expressive gestures');
    else if (talkative < -3) traits.push('quiet still pose');

    // 目の特徴
    if (curious > 5) traits.push('large sparkling curious eyes');
    if (emotional > 5) traits.push('soft warm emotional eyes');

    // 追加特徴
    if (creative > 5) traits.push('whimsical artistic details, unique color accents');
    if (adventurous > 5) traits.push('adventurous confident stance');

    // 進化段階ごとの詳細な外見定義
    const stageDetails = [
      { form: 'a tiny round egg-shaped blob', size: 'very small', detail: 'smooth surface, tiny dot eyes, no limbs' },
      { form: 'a small hatching creature', size: 'small', detail: 'just emerged, soft fluffy texture, tiny stubby arms, big round eyes' },
      { form: 'a cute compact creature', size: 'medium-small', detail: 'defined head and body, small hands and feet, expressive face' },
      { form: 'a well-formed charming creature', size: 'medium', detail: 'distinct personality features, detailed face, clear limbs, unique markings' },
      { form: 'a fully evolved unique creature', size: 'medium', detail: 'strong character design, elaborate features, distinctive silhouette, memorable appearance' },
    ];

    const sd = stageDetails[stage - 1];
    const traitStr = traits.join(', ');

    const prompt = `A single kawaii character: ${sd.form}. ${sd.detail}. ${traitStr}. Style: clean flat vector illustration, soft pastel color palette, thick outline, no background (pure transparent), centered full-body view, no text, no other characters, no accessories floating separately. High quality, professional character design.`;

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned');

    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    const fileName = `agent-${agentId}-stage${stage}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    await supabase.from('agents').update({ character_image_url: publicUrl }).eq('id', agentId);
    console.log('Character image generated:', publicUrl);
  } catch (error) {
    console.error('Error generating character image:', error);
    throw error;
  }
}

// 既読化
export async function PATCH(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get('agentId');
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    const supabase = getServerSupabase();
    await supabase
      .from('conversations')
      .update({ is_read: true })
      .eq('agent_id', agentId)
      .in('role', ['ai', 'assistant'])
      .eq('is_read', false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
