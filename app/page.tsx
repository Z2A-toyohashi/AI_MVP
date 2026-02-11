'use client';

import { useState, useRef } from "react";
import CameraView, { CameraViewHandle } from "../components/CameraView";
import Recorder, { RecorderHandle } from "../components/Recorder";

export default function Home() {
  const [verifying, setVerifying] = useState(false);
  const cameraRef = useRef<CameraViewHandle>(null);
  const recorderRef = useRef<RecorderHandle>(null);

  const startVerification = async () => {
    setVerifying(true);
    
    // カメラを先に起動
    await cameraRef.current?.startCamera();
    
    // カメラの準備ができるまで少し待つ
    setTimeout(() => {
      const videoRef = cameraRef.current?.getVideoRef();
      if (videoRef && videoRef.current) {
        console.log('カメラのvideoRefをRecorderに設定');
        recorderRef.current?.setCameraRef(videoRef);
      } else {
        console.warn('カメラのvideoRefが取得できませんでした');
      }
      
      // 録音を開始
      recorderRef.current?.startRecording();
    }, 1000);
  };

  const stopVerification = () => {
    setVerifying(false);
    // カメラと録音を停止
    cameraRef.current?.stopCamera();
    recorderRef.current?.stopRecording();
  };

  const handleCapture = async () => {
    if (!verifying) {
      alert('先に検証スタートボタンを押してください');
      return;
    }
    await recorderRef.current?.captureWithAudio();
  };

  return (
    <div className="p-6 space-y-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Living Lab</h1>
      </div>

      {/* 検証スタートボタン */}
      <div className="flex justify-center gap-4">
        <button
          onClick={verifying ? stopVerification : startVerification}
          className={`px-8 py-4 rounded-lg text-white font-bold text-lg ${
            verifying 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {verifying ? "🛑 検証終了" : "▶️ 検証スタート"}
        </button>

        {/* 撮影ボタン */}
        {verifying && (
          <button
            onClick={handleCapture}
            className="px-8 py-4 rounded-lg text-white font-bold text-lg bg-green-500 hover:bg-green-600"
          >
            📸 撮影
          </button>
        )}
      </div>

      {/* カメラ映像 */}
      <CameraView ref={cameraRef} />

      {/* 音声録音 */}
      <Recorder ref={recorderRef} />

    </div>
  );
}
