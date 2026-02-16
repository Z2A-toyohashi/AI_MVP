import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Supabase Upload API Start ===');
    
    const formData = await request.formData();
    const image = formData.get('image') as File;

    console.log('Image received:', image);
    console.log('Image name:', image?.name);
    console.log('Image size:', image?.size);
    console.log('Image type:', image?.type);

    if (!image) {
      console.error('No image file in request');
      return NextResponse.json({ error: 'No image file' }, { status: 400 });
    }

    // 5MBのファイルサイズ制限
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (image.size > MAX_SIZE) {
      console.error('File too large:', image.size);
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // ファイル名を生成（タイムスタンプ + ランダム文字列）
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileExt = image.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${randomStr}.${fileExt}`;

    console.log('Generated filename:', filename);

    // ArrayBufferに変換
    const arrayBuffer = await image.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    console.log('Uploading to Supabase Storage...');

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('uploads') // バケット名（Supabaseで作成する必要があります）
      .upload(filename, buffer, {
        contentType: image.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('Upload successful:', data);

    // 公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filename);

    const url = publicUrlData.publicUrl;
    console.log('Public URL:', url);
    console.log('=== Supabase Upload API Success ===');

    return NextResponse.json({ url });
  } catch (error) {
    console.error('=== Supabase Upload API Error ===');
    console.error('Upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
