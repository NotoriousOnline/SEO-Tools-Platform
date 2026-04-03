import { NextResponse } from "next/server";
import { generateImage, httpStatusForImageGenerationError } from "@/lib/geminiClient";
import { errorMessage, serverLog } from "@/lib/serverLog";

export async function postGenerateImageSingle(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid field: prompt (string)" },
        { status: 400 }
      );
    }

    const landscapeHint =
      "\n\nWide horizontal landscape (not square). Fill the frame edge-to-edge — no large empty sky or white bands above/below the subject.";
    const { base64, mimeType } = await generateImage(
      /\b(landscape|horizontal|16:9|2:1|fill the frame)\b/i.test(prompt) ? prompt : `${prompt.trim()}${landscapeHint}`,
      { aspectRatio: "16:9" }
    );
    return NextResponse.json({ base64, mimeType });
  } catch (err) {
    const msg = errorMessage(err);
    console.error("[generate-images/single] Error:", msg);
    void serverLog({ level: "error", source: "content-production/generate-image-single", message: msg });
    const status = httpStatusForImageGenerationError(err);
    return NextResponse.json({ error: msg || "Failed to generate image" }, { status });
  }
}
