import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase-client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { aiCharacterId } = await request.json();

    console.log('=== Image Generation Start ===');
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

    // 画像プロンプトリストを取得
    const imagePrompts = aiCharacter.image_prompts || [];
    
    if (imagePrompts.length === 0) {
      throw new Error('No image prompts configured for this AI character');
    }

    // ランダムにプロンプトを選択
    const selectedPrompt = imagePrompts[Math.floor(Math.random() * imagePrompts.length)];
    
    console.log('AI Character:', aiCharacter.name);
    console.log('Selected prompt:', selectedPrompt);

    // DALL-E 3で画像生成
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A minimalist, peaceful photograph of: ${selectedPrompt}. Natural lighting, soft colors, calm atmosphere, high quality, realistic style.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    if (!imageResponse.data || imageResponse.data.length === 0) {
      throw new Error('No image data returned from DALL-E');
    }

    const imageUrl = imageResponse.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    console.log('Image generated:', imageUrl);

    // 画像をダウンロード
    const imageBlob = await fetch(imageUrl).then(r => r.blob());
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Supabase Storageにアップロード
    const timestamp = Date.now();
    const filename = `ai-generated-${aiCharacterId}-${timestamp}.png`;

    console.log('Uploading to Supabase Storage:', filename);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filename, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    console.log('Upload successful:', uploadData);

    // 公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filename);

    const publicUrl = publicUrlData.publicUrl;

    // GPTで画像についての短いコメントを生成（AIキャラクターの性格を反映）
    const commentResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${aiCharacter.system_prompt}\n\nあなたが撮影した写真について、短く自然な一言コメントをつけてください。10文字以内が理想です。`,
        },
        {
          role: 'user',
          content: `この風景について一言: ${selectedPrompt}`,
        },
      ],
      temperature: 1.0,
      max_tokens: 50,
    });

    const comment = commentResponse.choices[0]?.message?.content?.trim() || 'いい感じ';

    console.log('Generated comment:', comment);
    console.log('=== Image Generation Success ===');

    return NextResponse.json({
      imageUrl: publicUrl,
      comment,
      scene: selectedPrompt,
    });
  } catch (error) {
    console.error('=== Image Generation Error ===');
    console.error('Error:', error);
    return NextResponse.json(
      { 
        error: 'Image generation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
