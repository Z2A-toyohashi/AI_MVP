import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSupabase } from '@/lib/supabase-client';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { prompt, userId } = await request.json();
    if (!prompt?.trim() || !userId) {
      return NextResponse.json({ error: 'prompt and userId required' }, { status: 400 });
    }

    // DALL-E 3でアバター生成
    const fullPrompt = `A cute kawaii avatar icon for a user profile. ${prompt.trim()}. Square composition, centered subject, clean simple background, flat illustration style, pastel colors, friendly and approachable, suitable as a profile picture.`;

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned');

    // Supabase Storageに保存
    const supabase = getServerSupabase();
    const buffer = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
    const fileName = `user-avatar-${userId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    return NextResponse.json({ error: 'Generation failed', details: String(error) }, { status: 500 });
  }
}
