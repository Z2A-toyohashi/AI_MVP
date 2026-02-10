// lib/storage-supabase.ts
import { getSupabaseClient } from './supabase';

export interface RecordData {
  id: string;
  type: 'audio' | 'image' | 'video';
  timestamp: string;
  transcript?: string;
  ai_response?: string;
  prompt?: string;
  media_url?: string;
}

const BUCKET_NAME = 'media-files';

// メディアファイルをSupabase Storageにアップロード
export async function uploadMediaToSupabase(
  file: Blob | File,
  filename: string
): Promise<string> {
  const supabase = getSupabaseClient();

  console.log('アップロード開始:', filename, 'サイズ:', file.size);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('アップロードエラー:', error);
    throw new Error(`ファイルのアップロードに失敗しました: ${error.message}`);
  }

  console.log('アップロード成功:', data);

  // 公開URLを取得
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  console.log('公開URL:', urlData.publicUrl);

  return urlData.publicUrl;
}

// レコードをデータベースに保存
export async function saveRecordToSupabase(
  data: Omit<RecordData, 'id' | 'timestamp'>
): Promise<RecordData> {
  const supabase = getSupabaseClient();

  const { data: record, error } = await supabase
    .from('records')
    .insert({
      type: data.type,
      transcript: data.transcript || null,
      ai_response: data.ai_response || null,
      prompt: data.prompt || null,
      media_url: data.media_url || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`レコードの保存に失敗しました: ${error.message}`);
  }

  return {
    id: record.id,
    type: record.type,
    timestamp: record.timestamp,
    transcript: record.transcript,
    ai_response: record.ai_response,
    prompt: record.prompt,
    media_url: record.media_url,
  };
}

// 全レコードを取得
export async function getRecordsFromSupabase(): Promise<RecordData[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    throw new Error(`レコードの取得に失敗しました: ${error.message}`);
  }

  return data.map((record) => ({
    id: record.id,
    type: record.type,
    timestamp: record.timestamp,
    transcript: record.transcript,
    ai_response: record.ai_response,
    prompt: record.prompt,
    media_url: record.media_url,
  }));
}

// レコードを削除
export async function deleteRecordFromSupabase(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  // レコード情報を取得
  const { data: record } = await supabase
    .from('records')
    .select('media_url')
    .eq('id', id)
    .single();

  // メディアファイルを削除
  if (record?.media_url) {
    const filename = record.media_url.split('/').pop();
    if (filename) {
      await supabase.storage.from(BUCKET_NAME).remove([filename]);
    }
  }

  // データベースからレコードを削除
  const { error } = await supabase.from('records').delete().eq('id', id);

  if (error) {
    throw new Error(`レコードの削除に失敗しました: ${error.message}`);
  }
}
