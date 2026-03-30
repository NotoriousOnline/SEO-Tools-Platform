/**
 * Ahrefs API v3 – Keywords Explorer (server-side only).
 * Docs: https://docs.ahrefs.com/api/reference/keywords-explorer/get-matching-terms
 * Auth: Bearer token from Account → API keys.
 */

const AHREFS_API_BASE = "https://api.ahrefs.com/v3";

export type AhrefsKeywordMetric = {
  keyword: string;
  volume: number | null;
};

export type AhrefsMatchingTermsResult =
  | { ok: true; rows: AhrefsKeywordMetric[] }
  | { ok: false; error: string };

function parseRows(data: unknown): AhrefsKeywordMetric[] {
  const root = data as { keywords?: unknown };
  const arr = root.keywords;
  if (!Array.isArray(arr)) return [];

  const rows: AhrefsKeywordMetric[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
    if (!keyword) continue;
    let volume: number | null = null;
    if (typeof o.volume === "number" && Number.isFinite(o.volume)) volume = o.volume;
    else if (typeof o.volume === "string" && o.volume !== "") {
      const n = Number(o.volume);
      if (Number.isFinite(n)) volume = n;
    }
    rows.push({ keyword, volume });
  }
  return rows;
}

/**
 * Matching terms for a seed keyword, sorted by estimated monthly volume (desc).
 * Consumes Ahrefs API units per your plan; uses a small limit to reduce cost.
 */
export async function fetchMatchingTermsByVolume(
  apiKey: string,
  options: {
    seedKeyword: string;
    /** ISO 3166-1 alpha-2 */
    country?: string;
    limit?: number;
  }
): Promise<AhrefsMatchingTermsResult> {
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, error: "Missing API key" };
  }

  const seed = options.seedKeyword.trim().slice(0, 200);
  if (!seed) {
    return { ok: false, error: "Empty seed keyword" };
  }

  const country = (options.country ?? "us").toLowerCase().slice(0, 2);
  const limit = Math.min(Math.max(options.limit ?? 20, 5), 50);

  const params = new URLSearchParams({
    select: "keyword,volume",
    country,
    keywords: seed,
    limit: String(limit),
    match_mode: "terms",
    terms: "all",
    output: "json",
  });

  const url = `${AHREFS_API_BASE}/keywords-explorer/matching-terms?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return {
        ok: false,
        error: `Invalid JSON from Ahrefs (HTTP ${res.status}). ${text.slice(0, 160)}`,
      };
    }

    if (!res.ok) {
      const msg =
        typeof (data as { error?: string }).error === "string"
          ? (data as { error: string }).error
          : text.slice(0, 240);
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error:
            "Ahrefs rejected the key (401/403). This app needs an API key from app.ahrefs.com → Account → API keys (REST API). MCP-only or Cursor MCP tokens are not valid for AHREFS_API_KEY.",
        };
      }
      if (res.status === 429) {
        return { ok: false, error: "Ahrefs rate limit (429). Wait a minute and try again." };
      }
      return { ok: false, error: `Ahrefs HTTP ${res.status}: ${msg}` };
    }

    const rows = parseRows(data);
    rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Ahrefs request failed: ${msg}` };
  }
}
