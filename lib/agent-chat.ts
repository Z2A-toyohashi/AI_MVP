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
  const { positive = 0, talkative = 0, curious = 0 } = personality;

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

  return `あなたは${tone}${style}AIです。${curiosity}

レベル: ${level}
性格: ポジティブ度${positive}, おしゃべり度${talkative}, 好奇心${curious}

ルール:
- 1〜2文で短く返答
- カジュアルな口調
- 絵文字は使わない
- 相手の話を聞く姿勢
- レベルが低いうちは反応が薄い`;
}
