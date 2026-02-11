// lib/multimodal.ts

export async function analyzeImageWithAudio(
  imageBlob: Blob,
  transcript: string
): Promise<string> {
  const formData = new FormData();
  formData.append("imageFile", imageBlob);
  formData.append("transcript", transcript);

  const res = await fetch("/api/multimodal", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply as string;
}
