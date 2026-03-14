// app/api/multimodal/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI APIキーが設定されていません" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    // JSON リクエスト（テキストのみ、マインドマップ分析など）
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { prompt, type } = body;

      if (!prompt) {
        return NextResponse.json({ error: "promptがありません" }, { status: 400 });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "あなたは分析アシスタントです。指示に従って正確に出力してください。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      });

      const result = completion.choices?.[0]?.message?.content ?? "";
      return NextResponse.json({ result });
    }

    // FormData リクエスト（画像 + 音声テキスト）
    const formData = await req.formData();
    const transcript = formData.get("transcript") as string | null;
    const imageFile = formData.get("imageFile") as File | null;

    if (!transcript) {
      return NextResponse.json({ error: "音声テキストがありません" }, { status: 400 });
    }
    if (!imageFile) {
      return NextResponse.json({ error: "画像がありません" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは親切で知識豊富なアシスタントです。ユーザーの発言内容と、その時の状況を示す画像を見て、自然で適切な応答をしてください。",
        },
        {
          role: "user",
          content: [
            { type: "text", text: transcript },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
    });

    const reply = completion.choices?.[0]?.message?.content ?? "申し訳ございません、応答を生成できませんでした。";
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Multimodal API error:", error);
    return NextResponse.json({ error: error.message || "Multimodal API failed" }, { status: 500 });
  }
}
