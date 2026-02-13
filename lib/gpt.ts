import OpenAI from 'openai';
import type { Post } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAIResponseWithGPT(
  systemPrompt: string,
  recentPosts: Post[],
  targetPost?: Post
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
      { role: 'system', content: systemPrompt },
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
            text: `以下の投稿に返信してください：\n\n${targetPost.author_id}: ${targetPost.content || '(画像のみ)'}\n\n最近の会話:\n${context}`,
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      });
    } else {
      // テキストのみの場合
      userMessage = targetPost
        ? `以下の投稿に返信してください：\n\n${targetPost.author_id}: ${targetPost.content}\n\n最近の会話:\n${context}`
        : `以下の会話の流れを見て、自然に参加してください:\n\n${context}`;
      
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature: 0.9,
      max_tokens: 50,
    });

    const content = response.choices[0]?.message?.content?.trim() || 'わかる';
    
    // 10文字以内に制限
    return content.slice(0, 10);
  } catch (error) {
    console.error('GPT API error:', error);
    // フォールバック
    const fallbacks = ['わかる', 'それな', 'そうなんだ', 'へー', 'なるほど'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
