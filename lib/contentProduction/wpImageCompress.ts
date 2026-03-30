import sharp from "sharp";

const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY = 85;

export async function compressImageForUpload(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  try {
    const pipeline = sharp(buffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true });

    const out = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
    return { buffer: out, mimeType: "image/jpeg", ext: "jpg" };
  } catch {
    return {
      buffer,
      mimeType: mimeType ?? "image/png",
      ext: mimeType?.includes("jpeg") || mimeType?.includes("jpg") ? "jpg" : "png",
    };
  }
}
