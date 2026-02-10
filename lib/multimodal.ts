// lib/multimodal.ts
import { getOpenAIApiKey } from "./settings";

export async function analyzeImageWithAudio(
  imageBlob: Blob,
  transcript: string
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("APIキーが設定されていません");
  }

  const formData = new FormData();
  formData.append("imageFile", imageBlob);
  formData.append("transcript", transcript);
  formData.append("apiKey", apiKey);

  const res = await fetch("/api/multimodal", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply as string;
}
