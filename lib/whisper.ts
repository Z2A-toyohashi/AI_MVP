// lib/whisper.ts

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  // ファイル名と拡張子を明示的に指定（Whisper APIがサポートする形式）
  formData.append("file", audioBlob, "audio.webm");

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.text;
}
