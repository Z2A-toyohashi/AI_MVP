import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI同士の交流ストーリーを生成
export async function generateEncounterStory(agentA: any, agentB: any): Promise<string> {
  const personalityA = agentA.personality || { positive: 0, talkative: 0, curious: 0 };
  const personalityB = agentB.personality || { positive: 0, talkative: 0, curious: 0 };

  const prompt = `2つの異なる性格のAIキャラクターが出会って、短い会話をしました。

キャラA「${agentA.name}」:
- ポジティブ度: ${personalityA.positive}
- おしゃべり度: ${personalityA.talkative}
- 好奇心: ${personalityA.curious}

キャラB「${agentB.name}」:
- ポジティブ度: ${personalityB.positive}
- おしゃべり度: ${personalityB.talkative}
- 好奇心: ${personalityB.curious}

この2人が出会って起きた、くだらないけど少し感情が動く短いストーリーを1〜2文で書いてください。
例: 「ずっと変なこと言ってた。でもなんか面白かった。」`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: '短くてくだらない、でも少し心に残る交流ストーリーを書くライターです。' 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 1.2,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content || '何か話した気がする。';
  } catch (error) {
    console.error('Error generating encounter story:', error);
    return '何か話した。よく覚えてない。';
  }
}
