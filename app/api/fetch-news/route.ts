import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase-client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { aiCharacterId } = await request.json();

    console.log('=== News Fetch Start ===');
    console.log('AI Character:', aiCharacterId);

    // AIキャラクターの情報を取得
    const { data: aiCharacter, error: characterError } = await supabase
      .from('ai_characters')
      .select('*')
      .eq('id', aiCharacterId)
      .single();

    if (characterError || !aiCharacter) {
      console.error('Failed to fetch AI character:', characterError);
      throw new Error('AI character not found');
    }

    // ニューストピックリストを取得
    const newsTopics = aiCharacter.news_topics || [];
    
    if (newsTopics.length === 0) {
      throw new Error('No news topics configured for this AI character');
    }

    // ランダムにトピックを選択
    const selectedTopic = newsTopics[Math.floor(Math.random() * newsTopics.length)];
    
    console.log('AI Character:', aiCharacter.name);
    console.log('Selected topic:', selectedTopic);

    // 今日の日付を取得
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    // GPTでニュースについてのコメントを生成
    // 注: 実際のニュース検索APIを使う場合は、ここでニュースを取得してからGPTに渡す
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${aiCharacter.system_prompt}\n\n今日は${today}です。最新のニュースや話題について、短く自然な口調でコメントしてください。`,
        },
        {
          role: 'user',
          content: `「${selectedTopic}」について、今日の話題や最近のトレンドを踏まえて、短くコメントしてください（15-30文字程度）。具体的な情報や数字は含めず、一般的な話題として語ってください。`,
        },
      ],
      temperature: 1.0,
      max_tokens: 100,
    });

    const comment = response.choices[0]?.message?.content?.trim() || '今日も色々なニュースがあるね';

    console.log('Generated comment:', comment);
    console.log('=== News Fetch Success ===');

    return NextResponse.json({
      comment,
      topic: selectedTopic,
      date: today,
    });
  } catch (error) {
    console.error('=== News Fetch Error ===');
    console.error('Error:', error);
    return NextResponse.json(
      { 
        error: 'News fetch failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
