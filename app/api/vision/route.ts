// app/api/vision/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const apiKey = process.env.OPENAI_API_KEY;
    const prompt = formData.get("prompt") as string | null;
    const file = formData.get("file") as File | null;

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI APIキーが設定されていません" }, { status: 500 });
    }
    if (!file) {
      return NextResponse.json({ error: "画像がありません" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 画像を base64 に変換
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // 型エラー回避のため any でラップ
    const completion = await (openai.chat.completions.create as any)({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは親切で知識豊富なアシスタントです。画像を見て、ユーザーの質問やリクエストに自然で適切な応答をしてください。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || "この画像について教えてください。",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const reply =
      completion.choices?.[0]?.message?.content ??
      "申し訳ございません、応答を生成できませんでした。";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Vision API error:", error);
    return NextResponse.json(
      { error: error.message || "Vision API failed" },
      { status: 500 }
    );
  }
}
