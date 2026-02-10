'use client';

import { useState, useRef } from "react";
import { analyzeImage } from "@/lib/vision";

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState("");

  // カメラ ON/OFF
  const toggleCamera = async () => {
    if (!cameraOn) {
      // カメラ ON
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
    } else {
      // カメラ OFF
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
    }
  };

  // 撮影して Vision に送る
  const capture = async () => {
    if (!cameraOn) {
      alert("カメラが OFF です。カメラを ON にしてください。");
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg")
    );

    const reply = await analyzeImage(blob, "この画像について説明してください。");
    setResult(reply);

    // ChatUI にも送る（任意）
    if (typeof window !== "undefined") {
      (window as any).addChatMessage?.(reply);
    }
  };

  return (
    <div className="space-y-4">
      <video ref={videoRef} autoPlay className="w-full rounded bg-black" />

      {/* カメラ ON/OFF */}
      <button
        onClick={toggleCamera}
        className={`px-4 py-2 rounded text-white ${
          cameraOn ? "bg-red-500" : "bg-blue-500"
        }`}
      >
        {cameraOn ? "カメラOFF" : "カメラON"}
      </button>

      {/* 撮影ボタン */}
      <button
        onClick={capture}
        disabled={!cameraOn}
        className={`px-4 py-2 rounded text-white ${
          cameraOn ? "bg-green-500" : "bg-gray-400"
        }`}
      >
        撮影して解析
      </button>

      {result && (
        <div className="p-4 bg-gray-100 rounded">
          <p className="font-semibold mb-1">AI の解析結果：</p>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}
