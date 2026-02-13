import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // 新しい形式（会話履歴あり）または旧形式（単一メッセージ）に対応
    if (!message && !messages) {
      return NextResponse.json(
        { error: "メッセージがありません" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `あなたは親切で共感的なAIアシスタントです。

特徴：
- ユーザーの気持ちに寄り添い、共感的に応答する
- 自然な会話口調で話す
- 質問には丁寧に答える
- 必要に応じてアドバイスや提案をする
- ユーザーが話しやすい雰囲気を作る
- 画像が送られた場合は、その内容を分析して適切に応答する

会話を通じて、ユーザーが安心して話せる相手になってください。`;

    let chatMessages: Array<any>;

    if (messages) {
      // 新しい形式：会話履歴を使用
      chatMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => {
          // contentが配列の場合（画像付きメッセージ）はそのまま使用
          if (Array.isArray(m.content)) {
            return {
              role: m.role,
              content: m.content
            };
          }
          // 通常のテキストメッセージ
          return { 
            role: m.role, 
            content: m.content 
          };
        }),
      ];
    } else {
      // 旧形式：単一メッセージ
      chatMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ];
    }

    // 画像が含まれている場合はgpt-4o、そうでなければgpt-4o-miniを使用
    const hasImage = messages?.some((m: any) => Array.isArray(m.content));
    const model = hasImage ? "gpt-4o" : "gpt-4o-mini";

    const response = await openai.chat.completions.create({
      model,
      messages: chatMessages,
      temperature: 0.8,
      max_tokens: 500,
    });

    const reply = response.choices[0].message.content;

    // 新旧両方の形式でレスポンスを返す
    return NextResponse.json({ 
      reply,
      response: reply 
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Chat API failed" },
      { status: 500 }
    );
  }
}
