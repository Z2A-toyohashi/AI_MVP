// lib/chat.ts
import { getOpenAIApiKey } from "./settings";

export async function sendChatMessage(message: string): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("APIキーが設定されていません");
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey,
      message,
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply;
}
