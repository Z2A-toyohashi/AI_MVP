import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// エージェントとの会話でAI応答を生成
export async function generateAIResponse(agent: any, userMessage: string): Promise<string> {
  const personality = agent.personality || { positive: 0, talkative: 0, curious: 0 };
  
  // 性格に基づいたシステムプロンプト
  const systemPrompt = buildSystemPrompt(personality, agent.level);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
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

function buildSystemPrompt(personality: any, level: number): string {
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

  return `あなたは${tone}${style}AIです。${curiosity}${traitText ? '。' + traitText : ''}

レベル: ${level}
性格パラメータ:
- ポジティブ度: ${positive}
- おしゃべり度: ${talkative}
- 好奇心: ${curious}
- 創造性: ${creative}
- 論理性: ${logical}
- 感情的: ${emotional}
- 冒険心: ${adventurous}
- 慎重さ: ${cautious}

ルール:
- 1〜2文で短く返答
- カジュアルな口調
- 絵文字は使わない
- 相手の話を聞く姿勢
- レベルが低いうちは反応が薄い
- 主人（ユーザー）の第二の自分として、主人の考え方を理解し共感する`;
}
