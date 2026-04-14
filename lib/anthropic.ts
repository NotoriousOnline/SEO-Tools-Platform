import Anthropic, { APIError, AuthenticationError } from "@anthropic-ai/sdk";

/**
 * Normalize key from .env (BOM, quotes, Bearer prefix, stray whitespace → 401 invalid x-api-key).
 * Optional: set ANTHROPIC_API_KEY instead of mixing in keys meant for other providers.
 */
export function getAnthropicApiKey(): string {
  const raw =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.ANTHROPIC_SECRET_KEY?.trim() ||
    "";
  let k = raw.replace(/^\uFEFF/, "").trim().replace(/^["']|["']$/g, "");
  if (/^Bearer\s+/i.test(k)) k = k.replace(/^Bearer\s+/i, "").trim();
  return k;
}

function getAnthropicClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (or Vercel env) and restart the dev server."
    );
  }
  return new Anthropic({ apiKey });
}

function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const s = (err as { status?: number | string }).status;
  if (typeof s === "number" && !Number.isNaN(s)) return s;
  if (typeof s === "string") {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function isAuthError(err: unknown): boolean {
  if (err instanceof AuthenticationError) return true;
  if (err instanceof APIError && httpStatus(err) === 401) return true;
  if (httpStatus(err) === 401) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /authentication_error|invalid x-api-key|invalid api key|^401\b/i.test(msg);
}

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
  options?: { maxTokens?: number }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 2048;
  const client = getAnthropicClient();
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
      if (isAuthError(err)) {
        const key = getAnthropicApiKey();
        const hint =
          key.length > 0 && !key.startsWith("sk-ant")
            ? " Your value does not look like an Anthropic secret (expected sk-ant-…). Make sure you are not using an OpenAI or other vendor key."
            : "";
        throw new Error(
          `Anthropic rejected the API key (401 invalid x-api-key).${hint} Create or rotate a key at https://console.anthropic.com/settings/keys and set ANTHROPIC_API_KEY in .env.local (one line, no quotes). Restart the dev server. On Vercel: Project → Settings → Environment Variables → redeploy.`
        );
      }
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
