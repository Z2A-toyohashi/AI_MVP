// lib/recorder.ts

export function createRecorder(
  onStop: (audioBlob: Blob) => void
) {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      onStop(blob);
    };

    mediaRecorder.start();
  }

  function stop() {
    mediaRecorder?.stop();
  }

  return { start, stop };
}
