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
        { role: "system", content: "あなたは親切で知識豊富なアシスタントです。ユーザーの発言内容に対して、自然で適切な応答をしてください。質問には答え、コメントには共感し、会話を続けるように心がけてください。" },
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
