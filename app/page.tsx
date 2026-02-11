'use client';

import { useState, useRef } from "react";
import CameraView, { CameraViewHandle } from "../components/CameraView";
import Recorder, { RecorderHandle } from "../components/Recorder";

export default function Home() {
  const [verifying, setVerifying] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraViewHandle>(null);
  const recorderRef = useRef<RecorderHandle>(null);

  const startVerification = async () => {
    setVerifying(true);
    
    try {
      // カメラを先に起動して完全に準備完了まで待つ
      await cameraRef.current?.startCamera();
      
      // カメラの準備ができるまで待つ（モバイル対応）
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const videoRef = cameraRef.current?.getVideoRef();
      if (videoRef && videoRef.current) {
        // videoが実際に再生されているか確認
        const video = videoRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          console.log('カメラ準備完了:', {
            readyState: video.readyState,
            width: video.videoWidth,
            height: video.videoHeight
          });
          recorderRef.current?.setCameraRef(videoRef);
        } else {
          console.warn('カメラの映像が準備できていません');
        }
      } else {
        console.warn('カメラのvideoRefが取得できませんでした');
      }
      
      // 録音を開始
      recorderRef.current?.startRecording();
    } catch (err) {
      console.error('検証開始エラー:', err);
      alert('カメラまたはマイクの起動に失敗しました');
      setVerifying(false);
    }
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
    if (capturing) {
      return; // 既に処理中
    }
    setCapturing(true);
    try {
      await recorderRef.current?.captureWithAudio();
    } finally {
      setCapturing(false);
    }
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
          className={`px-8 py-4 rounded-lg text-white font-bold text-lg shadow-xl transition-all duration-150 active:scale-90 active:shadow-inner select-none ${
            verifying 
              ? "bg-red-500 hover:bg-red-600 active:bg-red-700 active:brightness-90" 
              : "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 active:brightness-90"
          }`}
          style={{ 
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none'
          }}
        >
          {verifying ? "🛑 検証終了" : "▶️ 検証スタート"}
        </button>

        {/* 撮影ボタン */}
        {verifying && (
          <button
            onClick={handleCapture}
            disabled={capturing}
            className={`px-8 py-4 rounded-lg text-white font-bold text-lg shadow-xl transition-all duration-150 active:scale-90 active:shadow-inner active:brightness-90 select-none ${
              capturing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
            }`}
            style={{ 
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none'
            }}
          >
            {capturing ? '⏳ 処理中...' : '📸 撮影'}
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
