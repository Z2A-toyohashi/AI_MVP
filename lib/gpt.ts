import OpenAI from 'openai';
import type { Post } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAIResponseWithGPT(
  systemPrompt: string,
  recentPosts: Post[],
  targetPost?: Post,
  maxLength: number = 30,
  temperature: number = 1.0,
  presencePenalty: number = 0.6,
  frequencyPenalty: number = 0.6
): Promise<string> {
  try {
    // 画像があるかチェック
    const hasImage = targetPost?.media_url;
    const model = hasImage ? 'gpt-4o-mini' : 'gpt-4o-mini';

    // コンテキストを構築
    const context = recentPosts
      .slice(0, 5) // 最新5件
      .reverse()
      .map(p => `${p.author_id}: ${p.content}${p.media_url ? ' [画像あり]' : ''}`)
      .join('\n');

    let userMessage: string;
    const messages: Array<{ role: 'system' | 'user'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { 
        role: 'system', 
        content: `${systemPrompt}\n\n重要: あなたの返信は、あなた自身の発言のみを含めてください。他のユーザーIDやコロン（:）を含めないでください。自然な会話口調で短く返信してください。` 
      },
    ];

    if (targetPost && hasImage && targetPost.media_url) {
      // 画像がある場合はVision APIを使用
      const imageUrl = targetPost.media_url.startsWith('http') 
        ? targetPost.media_url 
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${targetPost.media_url}`;

      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `【返信対象】\n${targetPost.author_id}さんの投稿: ${targetPost.content || '(画像のみ)'}\n\n【参考: 最近の会話の流れ】\n${context}\n\n上記の${targetPost.author_id}さんの投稿と画像に対して、自然に返信してください。`,
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      });
    } else if (targetPost) {
      // 返信の場合：特定の投稿に対して返信
      userMessage = `【返信対象】\n${targetPost.author_id}さんの投稿: ${targetPost.content}\n\n【参考: 最近の会話の流れ】\n${context}\n\n上記の${targetPost.author_id}さんの投稿に対して、自然に返信してください。`;
      
      messages.push({ role: 'user', content: userMessage });
    } else {
      // 新規投稿の場合：新しい話題を提供
      userMessage = `【会話の流れ】\n${context}\n\n上記の会話とは異なる、新しい話題や視点を提供してください。最近の投稿に直接反応するのではなく、独立した新しいつぶやきをしてください。`;
      
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature: temperature,
      max_tokens: 100,
      presence_penalty: presencePenalty,
      frequency_penalty: frequencyPenalty,
    });

    const content = response.choices[0]?.message?.content?.trim() || 'わかる';
    
    // ユーザーIDとコロンを除去（例: "1234: " や "AI: " など）
    const cleanedContent = content.replace(/^\d+:\s*/, '').replace(/^[A-Za-z]+:\s*/, '').trim();
    
    // 設定された文字数以内に制限
    return cleanedContent.slice(0, maxLength);
  } catch (error) {
    console.error('GPT API error:', error);
    // フォールバック
    const fallbacks = ['わかる', 'それな', 'そうなんだ', 'へー', 'なるほど'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
