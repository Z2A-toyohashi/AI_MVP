'use client';

import Link from "next/link";
import CameraView from "../components/CameraView";
import Recorder from "../components/Recorder";

export default function Home() {
  return (
    <div className="p-6 space-y-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Living Lab</h1>

        <Link
          href="/settings"
          className="text-blue-500 hover:underline text-sm"
        >
          ⚙️ 設定
        </Link>
      </div>

      {/* カメラ映像 */}
      <CameraView />

      {/* 音声録音 */}
      <Recorder />

    </div>
  );
}
