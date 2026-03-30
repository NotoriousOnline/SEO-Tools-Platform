import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const MAX_429_RETRIES = 5;
const DEFAULT_RETRY_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMsFromError(err: unknown): number {
  if (err && typeof err === "object") {
    const o = err as { status?: number; headers?: Headers | Record<string, string> };
    if (o.status !== 429) return DEFAULT_RETRY_MS;
    const h = o.headers;
    if (h && typeof (h as Headers).get === "function") {
      const ra = (h as Headers).get("retry-after");
      if (ra) {
        const sec = parseInt(ra, 10);
        if (!Number.isNaN(sec) && sec > 0) return Math.min(sec * 1000, 120_000);
      }
    }
    if (h && typeof h === "object" && !(h instanceof Headers)) {
      const rec = h as Record<string, string>;
      const ra = rec["retry-after"] ?? rec["Retry-After"];
      if (ra) {
        const sec = parseInt(String(ra), 10);
        if (!Number.isNaN(sec) && sec > 0) return Math.min(sec * 1000, 120_000);
      }
    }
  }
  return DEFAULT_RETRY_MS;
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 429) return true;
  const msg = String((err as Error).message ?? err);
  return /rate.?limit|429/i.test(msg);
}

/**
 * Calls Claude with a system prompt and user message.
 * SERVER-SIDE ONLY — import only from /app/api/
 *
 * Retries on HTTP 429 (input TPM / rate limits) with Retry-After or a safe backoff.
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  opts?: { maxTokens?: number }
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? 2048;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === "text") {
        return firstBlock.text;
      }
      return "";
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === MAX_429_RETRIES) {
        throw err;
      }
      const wait = retryDelayMsFromError(err);
      console.warn(
        `[anthropic] Rate limited (429), retry ${attempt + 1}/${MAX_429_RETRIES} in ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}
