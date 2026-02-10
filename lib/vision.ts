// lib/vision.ts
import { getOpenAIApiKey } from "./settings";

export async function analyzeImage(imageBlob: Blob, prompt: string): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("APIキーが設定されていません");
  }

  const formData = new FormData();
  formData.append("file", imageBlob);
  formData.append("apiKey", apiKey);
  formData.append("prompt", prompt);

  const res = await fetch("/api/vision", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply as string;
}
