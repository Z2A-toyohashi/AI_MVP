'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { createRecorder } from "@/lib/recorder";
import { transcribeAudio } from "@/lib/whisper";
import { analyzeImageWithAudio } from "@/lib/multimodal";
import { saveRecord } from "@/lib/storage";

export interface RecorderHandle {
  startRecording: () => void;
  stopRecording: () => void;
  setCameraRef: (ref: React.RefObject<HTMLVideoElement | null>) => void;
  captureWithAudio: () => Promise<void>;
}

const Recorder = forwardRef<RecorderHandle>((props, ref) => {
  const [recording, setRecording] = useState(false);
  const [micOn, setMicOn] = useState(false);

  const recorderRef = useRef<any>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 親コンポーネントから呼び出せるメソッドを公開
  useImperativeHandle(ref, () => ({
    startRecording: async () => {
      await startContinuousRecording();
    },
    stopRecording: () => {
      stopContinuousRecording();
    },
    setCameraRef: (ref: React.RefObject<HTMLVideoElement | null>) => {
      cameraVideoRef.current = ref.current;
    },
    captureWithAudio: async () => {
      await captureImageWithCurrentAudio();
    },
  }));

  // 連続録音を開始
  const startContinuousRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // 1秒ごとにチャンクを保存
      mediaRecorder.start(1000);
      setRecording(true);
      setMicOn(true);
      console.log('連続録音開始');
    } catch (err: any) {
      console.error('録音開始エラー:', err);
      alert(`録音開始に失敗しました: ${err.message}`);
    }
  };

  // 連続録音を停止
  const stopContinuousRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecording(false);
      setMicOn(false);
      console.log('連続録音停止');
    }
  };

  // カメラのフレームをキャプチャ
  const captureFrame = async (): Promise<Blob | null> => {
    const video = cameraVideoRef.current;
    
    if (!video) {
      console.log('カメラのvideoRefが設定されていません');
      return null;
    }
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log('カメラの準備ができていません');
      return null;
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('カメラの映像サイズが0です');
      return null;
    }

    console.log('カメラフレームをキャプチャ中...', {
      width: video.videoWidth,
      height: video.videoHeight,
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log('Canvas contextの取得に失敗');
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => {
        if (b) {
          console.log('画像キャプチャ成功。サイズ:', b.size);
        }
        resolve(b!);
      }, "image/jpeg", 0.95);
    });
  };

  // 現在の音声と画像をキャプチャしてAIに送信
  const captureImageWithCurrentAudio = async () => {
    try {
      console.log('撮影ボタン押下');

      // 現在までの音声を取得
      if (audioChunksRef.current.length === 0) {
        alert('音声データがありません。少し話してから撮影してください。');
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('音声データサイズ:', audioBlob.size);

      // 音声を文字起こし
      const text = await transcribeAudio(audioBlob);
      console.log('文字起こし完了:', text);

      // カメラのフレームをキャプチャ
      const imageBlob = await captureFrame();

      if (!imageBlob) {
        alert('画像のキャプチャに失敗しました');
        return;
      }

      // 画像と音声を組み合わせて分析
      console.log('マルチモーダル分析開始...');
      const aiReply = await analyzeImageWithAudio(imageBlob, text);
      console.log('AI応答:', aiReply);

      // データを保存（音声ファイル）
      console.log('音声データ保存中...');
      await saveRecord({
        type: 'audio',
        transcript: text,
        ai_response: aiReply,
        mediaFile: audioBlob,
      });
      console.log('音声データ保存完了');

      // 画像も別途保存
      console.log('画像データ保存中...');
      await saveRecord({
        type: 'image',
        prompt: `音声: "${text}"`,
        ai_response: aiReply,
        mediaFile: imageBlob,
      });
      console.log('画像データ保存完了');

      console.log('撮影完了！');
      
      // 撮影後も録音は継続（チャンクはリセットしない）
    } catch (err: any) {
      console.error('撮影エラー:', err);
      alert(`エラー: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 録音状態の表示 */}
      {recording && (
        <div className="flex items-center gap-2 text-red-500">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-semibold">録音中...</span>
        </div>
      )}
    </div>
  );
});

Recorder.displayName = 'Recorder';

export default Recorder;
