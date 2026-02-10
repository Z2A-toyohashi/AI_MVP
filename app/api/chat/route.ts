import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { apiKey, message } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "APIキーが送信されていません" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "メッセージがありません" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "あなたは AI Living Lab のアシスタントです。" },
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Chat API failed" },
      { status: 500 }
    );
  }
}
