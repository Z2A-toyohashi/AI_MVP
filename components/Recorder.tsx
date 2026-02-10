'use client';

import { useState, useRef } from "react";
import { createRecorder } from "@/lib/recorder";
import { transcribeAudio } from "@/lib/whisper";
import { sendChatMessage } from "@/lib/chat";

export default function Recorder() {
  const [recording, setRecording] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  const recorderRef = useRef<any>(null);

  // マイク ON/OFF
  const toggleMic = async () => {
    if (!micOn) {
      // マイク ON
      recorderRef.current = createRecorder(async (audioBlob) => {
        try {
          const text = await transcribeAudio(audioBlob);
          setTranscript(text);

          const aiReply = await sendChatMessage(text);
          setReply(aiReply);

          // ChatUI にも送る（任意）
          if (typeof window !== "undefined") {
            (window as any).addChatMessage?.(aiReply);
          }
        } catch (err: any) {
          alert(err.message);
        }
      });

      setMicOn(true);
    } else {
      // マイク OFF
      if (recording) {
        recorderRef.current?.stop();
        setRecording(false);
      }
      recorderRef.current = null;
      setMicOn(false);
    }
  };

  // 録音開始/停止
  const handleRecord = () => {
    if (!micOn) {
      alert("マイクが OFF です。マイクを ON にしてください。");
      return;
    }

    if (recording) {
      recorderRef.current.stop();
      setRecording(false);
    } else {
      recorderRef.current.start();
      setRecording(true);
    }
  };

  return (
    <div className="space-y-4">

      {/* マイク ON/OFF ボタン */}
      <button
        onClick={toggleMic}
        className={`px-4 py-2 rounded text-white ${
          micOn ? "bg-green-600" : "bg-gray-500"
        }`}
      >
        {micOn ? "マイクOFF" : "マイクON"}
      </button>

      {/* 録音ボタン */}
      <button
        onClick={handleRecord}
        disabled={!micOn}
        className={`px-4 py-2 rounded text-white ${
          recording ? "bg-red-500" : micOn ? "bg-blue-500" : "bg-gray-400"
        }`}
      >
        {recording ? "停止" : "録音開始"}
      </button>

      {/* Whisper の文字起こし */}
      {transcript && (
        <div className="p-4 bg-gray-100 rounded">
          <p className="font-semibold mb-1">文字起こし結果：</p>
          <p>{transcript}</p>
        </div>
      )}

      {/* ChatGPT の返答 */}
      {reply && (
        <div className="p-4 bg-blue-50 rounded">
          <p className="font-semibold mb-1">AI の返答：</p>
          <p>{reply}</p>
        </div>
      )}
    </div>
  );
}
