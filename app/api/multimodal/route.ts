// app/api/multimodal/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const apiKey = formData.get("apiKey") as string | null;
    const transcript = formData.get("transcript") as string | null;
    const imageFile = formData.get("imageFile") as File | null;

    if (!apiKey) {
      return NextResponse.json({ error: "APIキーがありません" }, { status: 400 });
    }
    if (!transcript) {
      return NextResponse.json({ error: "音声テキストがありません" }, { status: 400 });
    }
    if (!imageFile) {
      return NextResponse.json({ error: "画像がありません" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 画像を base64 に変換
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // GPT-4 Vision で画像と音声テキストを組み合わせて応答
    const completion = await (openai.chat.completions.create as any)({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは親切で知識豊富なアシスタントです。ユーザーの発言内容と、その時の状況を示す画像を見て、自然で適切な応答をしてください。質問には答え、コメントには共感し、会話を続けるように心がけてください。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: transcript,
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
    console.error("Multimodal API error:", error);
    return NextResponse.json(
      { error: error.message || "Multimodal API failed" },
      { status: 500 }
    );
  }
}
