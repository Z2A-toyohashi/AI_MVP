// app/api/vision/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const apiKey = formData.get("apiKey") as string | null;
    const prompt = formData.get("prompt") as string | null;
    const file = formData.get("file") as File | null;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキーがありません" }, { status: 400 });
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
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || "この画像を説明してください。",
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
      "説明を生成できませんでした。";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Vision API error:", error);
    return NextResponse.json(
      { error: error.message || "Vision API failed" },
      { status: 500 }
    );
  }
}
