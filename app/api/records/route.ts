// app/api/records/route.ts
import { NextResponse } from 'next/server';
import { 
  saveRecordToSupabase, 
  getRecordsFromSupabase, 
  deleteRecordFromSupabase,
  uploadMediaToSupabase 
} from '@/lib/storage-supabase';

// GET: 全レコード取得
export async function GET() {
  try {
    const records = await getRecordsFromSupabase();
    return NextResponse.json({ records });
  } catch (error: any) {
    console.error('Records GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get records' },
      { status: 500 }
    );
  }
}

// POST: 新規レコード追加
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const type = formData.get('type') as string;
    const transcript = formData.get('transcript') as string | null;
    const aiResponse = formData.get('aiResponse') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const mediaFile = formData.get('mediaFile') as File | null;
    
    let mediaUrl: string | undefined;
    
    // メディアファイルがある場合はSupabase Storageにアップロード
    if (mediaFile) {
      const timestamp = Date.now();
      const filename = `${type}-${timestamp}-${mediaFile.name}`;
      mediaUrl = await uploadMediaToSupabase(mediaFile, filename);
    }
    
    // データベースに保存
    const record = await saveRecordToSupabase({
      type: type as 'audio' | 'image' | 'video',
      transcript: transcript || undefined,
      ai_response: aiResponse || undefined,
      prompt: prompt || undefined,
      media_url: mediaUrl,
    });
    
    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Records POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save record' },
      { status: 500 }
    );
  }
}

// DELETE: レコード削除
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    
    await deleteRecordFromSupabase(id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Records DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete record' },
      { status: 500 }
    );
  }
}
