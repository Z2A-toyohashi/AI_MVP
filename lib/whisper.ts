// lib/whisper.ts
import { getOpenAIApiKey } from "./settings";

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("APIキーが設定されていません");
  }

  const formData = new FormData();
  formData.append("file", audioBlob);
  formData.append("apiKey", apiKey);

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
