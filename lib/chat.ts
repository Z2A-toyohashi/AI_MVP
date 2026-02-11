// lib/chat.ts

export async function sendChatMessage(message: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply;
}
