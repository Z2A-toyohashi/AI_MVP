import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    // フロントから送られてくる FormData を取得
    const formData = await req.formData();

    // localStorage から送られてきた API キーを取得
    const apiKey = formData.get("apiKey") as string | null;
    if (!apiKey) {
      return NextResponse.json(
        { error: "APIキーが送信されていません" },
        { status: 400 }
      );
    }

    // 音声ファイルを取得
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "音声ファイルがありません" },
        { status: 400 }
      );
    }

    // OpenAI クライアントを API キーで初期化
    const openai = new OpenAI({ apiKey });

    // Whisper API（whisper-1）で文字起こし
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ja",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: error.message || "Transcription failed" },
      { status: 500 }
    );
  }
}
