// lib/vision.ts

export async function analyzeImage(imageBlob: Blob, prompt: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", imageBlob);
  formData.append("prompt", prompt);

  const res = await fetch("/api/vision", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply as string;
}
