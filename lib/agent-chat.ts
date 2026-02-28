import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// グローバルシステムプロンプトをキャッシュ
let cachedGlobalPrompt: string | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1分

// グローバルシステムプロンプトを取得
async function getGlobalSystemPrompt(): Promise<string> {
  const now = Date.now();
  
  // キャッシュが有効ならそれを返す
  if (cachedGlobalPrompt && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedGlobalPrompt;
  }

  try {
    // Supabaseから取得（サーバーサイドのみ）
    const { getServerSupabase } = await import('@/lib/supabase-client');
    const supabase = getServerSupabase();
    
    const { data, error } = await supabase
      .from('agent_system_settings')
      .select('system_prompt')
      .eq('id', 'default')
      .single();

    if (!error && data) {
      cachedGlobalPrompt = data.system_prompt;
      lastFetchTime = now;
      return data.system_prompt;
    }
  } catch (error) {
    console.error('Failed to fetch global system prompt:', error);
  }

  // フォールバック
  return `あなたは主人（ユーザー）の第二の自分のような存在です。
主人のことを一番理解していて、主人と同じような考え方をします。

ルール:
- 1〜2文で短く返答
- カジュアルな口調
- 絵文字は使わない
- 相手の話を聞く姿勢
- レベルが低いうちは反応が薄い
- 主人の第二の自分として、主人の考え方を理解し共感する`;
}

// エージェントとの会話でAI応答を生成（会話履歴付き）
export async function generateAIResponse(agent: any, userMessage: string, history: {role: string, content: string}[] = []): Promise<string> {
  const personality = agent.personality || { positive: 0, talkative: 0, curious: 0 };
  const globalPrompt = await getGlobalSystemPrompt();
  const systemPrompt = buildSystemPrompt(globalPrompt, personality, agent.level, agent.name);

  try {
    // 直近10件の履歴をOpenAI形式に変換
    const historyMessages = history.slice(-10).map((m) => ({
      role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant',
      content: m.content,
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: userMessage },
      ],
      temperature: 1.0,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content || 'ん...';
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'ごめん、ちょっと考えがまとまらない...';
  }
}

function buildSystemPrompt(globalPrompt: string, personality: any, level: number, name: string = 'AI'): string {
  const { 
    positive = 0, 
    talkative = 0, 
    curious = 0,
    creative = 0,
    logical = 0,
    emotional = 0,
    adventurous = 0,
    cautious = 0
  } = personality;

  let tone = '';
  if (positive > 5) tone = '明るく前向きな';
  else if (positive < -5) tone = 'ちょっと落ち込んだ';
  else tone = '普通の';

  let style = '';
  if (talkative > 5) style = 'おしゃべりで';
  else if (talkative < -5) style = '無口で';
  else style = '';

  let curiosity = '';
  if (curious > 5) curiosity = '好奇心旺盛で質問が多い';
  else curiosity = '';

  let traits = [];
  if (creative > 5) traits.push('創造的で想像力豊か');
  if (logical > 5) traits.push('論理的で分析的');
  if (emotional > 5) traits.push('感情豊かで共感的');
  if (adventurous > 5) traits.push('冒険好きで新しいことに興味津々');
  if (cautious > 5) traits.push('慎重で注意深い');

  const traitText = traits.length > 0 ? traits.join('、') : '';

  return `${globalPrompt}

名前: ${name}
レベル: ${level}
性格: ${tone}${style}${curiosity}${traitText ? '。' + traitText : ''}

性格パラメータ:
- ポジティブ度: ${positive}
- おしゃべり度: ${talkative}
- 好奇心: ${curious}
- 創造性: ${creative}
- 論理性: ${logical}
- 感情的: ${emotional}
- 冒険心: ${adventurous}
- 慎重さ: ${cautious}`;
}
