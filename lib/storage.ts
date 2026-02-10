// lib/storage.ts
// データ保存用のユーティリティ

export interface RecordData {
  id: string;
  type: 'audio' | 'image' | 'video';
  timestamp: string;
  transcript?: string;
  ai_response?: string;
  prompt?: string;
  media_url?: string;
}

export async function saveRecord(
  data: Omit<RecordData, 'id' | 'timestamp'> & { mediaFile?: Blob | File }
): Promise<RecordData> {
  const formData = new FormData();
  
  formData.append('type', data.type);
  
  if (data.transcript) {
    formData.append('transcript', data.transcript);
  }
  
  if (data.ai_response) {
    formData.append('aiResponse', data.ai_response);
  }
  
  if (data.prompt) {
    formData.append('prompt', data.prompt);
  }
  
  if (data.mediaFile) {
    formData.append('mediaFile', data.mediaFile);
  }

  const res = await fetch('/api/records', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('データの保存に失敗しました');
  }

  const result = await res.json();
  return result.record;
}

export async function getRecords(): Promise<RecordData[]> {
  const res = await fetch('/api/records');
  
  if (!res.ok) {
    throw new Error('データの取得に失敗しました');
  }

  const data = await res.json();
  return data.records || [];
}
