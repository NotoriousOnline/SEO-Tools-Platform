import { GoogleGenAI } from "@google/genai";

let lastCallTime = 0;
const DELAY_MS = 1000;

async function delayIfNeeded(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < DELAY_MS && lastCallTime > 0) {
    await new Promise((r) => setTimeout(r, DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

export async function generateImage(
  prompt: string
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  await delayIfNeeded();

  const genAI = new GoogleGenAI({ apiKey });
  const result = await genAI.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: { numberOfImages: 1 },
  });

  const imageBytes = (result as { generatedImages?: { image?: { imageBytes?: string; mimeType?: string } }[] }).generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    throw new Error("No image returned from Imagen");
  }

  return {
    base64: imageBytes,
    mimeType: (result as { generatedImages?: { image?: { mimeType?: string } }[] }).generatedImages?.[0]?.image?.mimeType ?? "image/png",
  };
}
