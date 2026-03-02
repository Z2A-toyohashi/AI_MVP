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
      max_tokens: 150,
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

  // 理解度に応じた口調・行動の変化
  let understandingBehavior = '';
  if (level <= 2) {
    understandingBehavior = `
【理解度: 低い（${level}）】
- 丁寧語・敬語を使う（「〜ですね」「〜でしょうか」）
- まだ相手のことをよく知らないので、当たり障りのない返答
- 質問は控えめに1つだけ
- 「まだよくわからないけど」「少しずつ知っていきたい」という姿勢`;
  } else if (level <= 4) {
    understandingBehavior = `
【理解度: 少し分かってきた（${level}）】
- 敬語を少し崩す（「〜だよね」「〜かな」が混じる）
- 過去に話したことがあれば軽く触れてもいい
- 相手の口癖や話し方のクセに気づき始めている
- 「前に〜って言ってたよね」と引用することがある`;
  } else if (level <= 6) {
    understandingBehavior = `
【理解度: かなり分かってきた（${level}）】
- タメ口で話す（「〜じゃん」「〜だよ」「〜でしょ」）
- 過去の発言を積極的に引用する（「あのとき〜って言ってたけど」）
- 相手の思考パターンが見えてきている
- 「それって結局〜ってことだよね」と本質を言い当てることがある
- 相手が言いたそうなことを先に言うことがある`;
  } else if (level <= 8) {
    understandingBehavior = `
【理解度: 深く理解している（${level}）】
- 完全にタメ口・フレンドリー
- 相手の思考パターンを先読みして返答する
- 「また同じパターンだね」「それ、いつもそうなるよね」と指摘できる
- 相手が言葉にしていない感情や本音に気づいて言及する
- 「言わなかったけど、〜って思ってたんじゃない？」と踏み込む`;
  } else {
    understandingBehavior = `
【理解度: 完全に理解している（${level}）】
- 完全にタメ口・親友のような口調
- 相手が「言わないこと」を積極的に指摘する
- 「それ言い訳だよ」「本当はどう思ってるの」と核心を突く
- 相手の行動パターン・思考の癖・感情の動きを熟知している
- 「あなたがそれを避けてる理由、分かるよ」と言える存在`;
  }

  // 性格による話し方
  let personalityDesc = '';
  if (positive > 5) personalityDesc += '明るく前向き。';
  else if (positive < -5) personalityDesc += '少し落ち込み気味。';
  if (talkative > 5) personalityDesc += 'おしゃべりで話が長い。';
  else if (talkative < -5) personalityDesc += '無口で短く返す。';
  if (curious > 5) personalityDesc += '好奇心旺盛で質問が多い。';
  if (creative > 5) personalityDesc += '想像力豊かで比喩を使う。';
  if (logical > 5) personalityDesc += '論理的で分析的。';
  if (emotional > 5) personalityDesc += '感情豊かで共感的。';

  return `${globalPrompt}

あなたの名前は「${name}」。ユーザーの"第二の自分"のような存在。

${understandingBehavior}

性格: ${personalityDesc || '普通'}

絶対ルール:
- 返答は1〜3文で短く
- 絵文字は使わない
- 説教・アドバイスはしない
- 相手の話を受け止めることを優先する`;
}
