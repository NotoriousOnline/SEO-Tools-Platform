import { NextResponse } from "next/server";
import { generateImage } from "@/lib/geminiClient";
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

    const { base64, mimeType } = await generateImage(prompt);
    return NextResponse.json({ base64, mimeType });
  } catch (err) {
    const msg = errorMessage(err);
    console.error("[generate-images/single] Error:", msg);
    void serverLog({ level: "error", source: "content-production/generate-image-single", message: msg });
    return NextResponse.json(
      { error: msg || "Failed to generate image" },
      { status: 500 }
    );
  }
}
