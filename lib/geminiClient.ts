import { ApiError, GoogleGenAI, PersonGeneration, SafetyFilterLevel } from "@google/genai";
import { errorMessage } from "@/lib/serverLog";

/** Thrown when retryable Imagen errors persist after all attempts (client should show 503-style guidance). */
export const IMAGE_GENERATION_OVERLOAD_USER_MESSAGE =
  "Image generation is temporarily overloaded. Wait a minute and try again, or generate fewer images at once.";

/** HTTP 200 but no image bytes after retries (transient or prompt/model issue). */
export const IMAGE_GENERATION_EMPTY_USER_MESSAGE =
  "Image generation did not return image data. Wait a moment and try again, or simplify the image prompt.";

/** Internal marker for empty-body responses we should retry. */
const IMAGEN_NO_BYTES_TRANSIENT = "__IMAGEN_NO_BYTES_TRANSIENT__";

type GeneratedImageEntry = {
  image?: { imageBytes?: string; mimeType?: string };
  raiFilteredReason?: string;
};

function pickImageFromResult(result: { generatedImages?: GeneratedImageEntry[] }): {
  base64: string;
  mimeType: string;
} | null {
  const imgs = result.generatedImages ?? [];
  const raiReasons: string[] = [];
  for (const gi of imgs) {
    const bytes = gi.image?.imageBytes;
    if (typeof bytes === "string" && bytes.length > 0) {
      return {
        base64: bytes,
        mimeType: gi.image?.mimeType ?? "image/png",
      };
    }
    if (gi.raiFilteredReason) raiReasons.push(gi.raiFilteredReason);
  }
  if (raiReasons.length > 0) {
    throw new Error(`Imagen content policy: ${raiReasons[0]}`);
  }
  return null;
}

function geminiHttpStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === "number" && Number.isFinite(s)) return s;
  }
  return undefined;
}

/** JSON body on ApiError.message (Google GenAI SDK stringifies errors). */
function parseOverloadedFromApiErrorMessage(err: unknown): boolean {
  const msg = errorMessage(err);
  try {
    const parsed = JSON.parse(msg) as unknown;
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      const inner = o.error;
      if (inner && typeof inner === "object") {
        const t = (inner as { type?: string }).type;
        const m = String((inner as { message?: string }).message ?? "").toLowerCase();
        if (t === "overloaded_error" || t === "RESOURCE_EXHAUSTED") return true;
        if (m.includes("overloaded") || m.includes("resource exhausted")) return true;
      }
    }
  } catch {
    /* not JSON */
  }
  return false;
}

/** True when the route should return 503 (retry later) rather than 500. */
export function isImageGenerationOverloadExhausted(err: unknown): boolean {
  if (errorMessage(err) === IMAGE_GENERATION_OVERLOAD_USER_MESSAGE) return true;
  const status = geminiHttpStatus(err);
  if (status === 429 || status === 503 || status === 529) return true;
  if (parseOverloadedFromApiErrorMessage(err)) return true;
  const lower = errorMessage(err).toLowerCase();
  return lower.includes("overloaded") || lower.includes("resource_exhausted");
}

/** Map handler errors to HTTP status (overload 503, safety 422, empty 503, else 500). */
export function httpStatusForImageGenerationError(err: unknown): number {
  const msg = errorMessage(err);
  if (msg.startsWith("Imagen content policy:")) return 422;
  if (msg === IMAGE_GENERATION_EMPTY_USER_MESSAGE) return 503;
  if (isImageGenerationOverloadExhausted(err)) return 503;
  return 500;
}

let lastCallTime = 0;
/** Minimum gap between Imagen API calls to reduce burst overload. */
const DELAY_MS = 3000;

const MAX_IMAGE_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 3000;
const MAX_BACKOFF_MS = 120_000;

async function delayIfNeeded(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < DELAY_MS && lastCallTime > 0) {
    await new Promise((r) => setTimeout(r, DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attemptIndex: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * 1500);
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

function isRetryableImagenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === IMAGEN_NO_BYTES_TRANSIENT) return true;
  const byStatus = geminiHttpStatus(err);
  if (byStatus !== undefined && (byStatus === 429 || byStatus === 500 || byStatus === 502 || byStatus === 503 || byStatus === 529)) {
    return true;
  }
  if (err instanceof ApiError) {
    const s = err.status;
    if (s === 429 || s === 500 || s === 502 || s === 503 || s === 529) return true;
  }
  if (parseOverloadedFromApiErrorMessage(err)) return true;
  const lower = msg.toLowerCase();
  return (
    lower.includes("overloaded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("unavailable") ||
    lower.includes("529") ||
    lower.includes("503") ||
    lower.includes("502")
  );
}

export async function generateImage(
  prompt: string
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenAI({ apiKey });
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_IMAGE_ATTEMPTS; attempt++) {
    await delayIfNeeded();
    try {
      const result = await genAI.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: { numberOfImages: 1 },
      });

      const imageBytes = (result as { generatedImages?: { image?: { imageBytes?: string; mimeType?: string } }[] })
        .generatedImages?.[0]?.image?.imageBytes;
      if (!imageBytes) {
        throw new Error("No image returned from Imagen");
      }

      return {
        base64: imageBytes,
        mimeType:
          (result as { generatedImages?: { image?: { mimeType?: string } }[] }).generatedImages?.[0]?.image?.mimeType ??
          "image/png",
      };
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableImagenError(err);
      const hasMore = attempt < MAX_IMAGE_ATTEMPTS - 1;
      if (!retryable || !hasMore) {
        break;
      }
      const wait = backoffMs(attempt);
      console.warn(
        `[geminiClient] Imagen call failed (attempt ${attempt + 1}/${MAX_IMAGE_ATTEMPTS}), retrying in ${wait}ms:`,
        err instanceof Error ? err.message : err
      );
      await sleep(wait);
    }
  }

  if (lastErr instanceof Error) {
    if (lastErr.message === IMAGEN_NO_BYTES_TRANSIENT) {
      throw new Error(IMAGE_GENERATION_EMPTY_USER_MESSAGE, { cause: lastErr });
    }
    if (isRetryableImagenError(lastErr)) {
      throw new Error(IMAGE_GENERATION_OVERLOAD_USER_MESSAGE, { cause: lastErr });
    }
    throw lastErr;
  }
  throw lastErr;
}
