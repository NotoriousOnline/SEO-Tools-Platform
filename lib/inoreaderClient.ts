/**
 * Inoreader Reader API — stream contents for Article Title Discovery.
 * @see https://www.inoreader.com/developers/stream-contents
 * @see https://www.inoreader.com/developers/oauth
 *
 * Register an app, add OAuth (refresh token), put blogs in an Inoreader folder,
 * then set INOREADER_STREAM_ID to that folder (e.g. user/-/label/Your Folder).
 */

const INOREADER_ORIGIN = "https://www.inoreader.com";

export type InoreaderStreamItem = {
  title?: string;
  published?: number;
  canonical?: Array<{ href?: string }>;
  alternate?: Array<{ href?: string; type?: string }>;
  origin?: { title?: string; streamId?: string; htmlUrl?: string };
};

export type InoreaderStreamResponse = {
  items?: InoreaderStreamItem[];
  continuation?: string;
};

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
};

let cachedTokens: TokenBundle | null = null;

function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export function isInoreaderConfigured(): boolean {
  return Boolean(
    readEnv("INOREADER_CLIENT_ID") &&
      readEnv("INOREADER_CLIENT_SECRET") &&
      readEnv("INOREADER_REFRESH_TOKEN") &&
      readEnv("INOREADER_STREAM_ID")
  );
}

function inoreaderHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "SEO-Tools-Platform/1.0 (Article Title Discovery)",
  };
  const appId = readEnv("INOREADER_APP_ID");
  const appKey = readEnv("INOREADER_APP_KEY");
  if (appId) headers.AppId = appId;
  if (appKey) headers.AppKey = appKey;
  return headers;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenBundle> {
  const clientId = readEnv("INOREADER_CLIENT_ID");
  const clientSecret = readEnv("INOREADER_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("INOREADER_CLIENT_ID and INOREADER_CLIENT_SECRET are required");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${INOREADER_ORIGIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const raw = await res.text();
  let data: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    throw new Error(`Inoreader token response was not JSON (HTTP ${res.status})`);
  }

  if (!res.ok || !data.access_token) {
    const msg = data.error ?? raw.slice(0, 200) ?? `HTTP ${res.status}`;
    throw new Error(`Inoreader OAuth refresh failed: ${msg}`);
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  const nextRefresh = data.refresh_token ?? refreshToken;

  return {
    accessToken: data.access_token,
    refreshToken: nextRefresh,
    expiresAtMs: Date.now() + Math.max(60, expiresIn - 120) * 1000,
  };
}

async function getValidAccessToken(): Promise<string> {
  const envRefresh = readEnv("INOREADER_REFRESH_TOKEN");
  if (!envRefresh) {
    throw new Error("INOREADER_REFRESH_TOKEN is not set");
  }

  const now = Date.now();
  if (cachedTokens && cachedTokens.expiresAtMs > now && cachedTokens.refreshToken === envRefresh) {
    return cachedTokens.accessToken;
  }

  const bundle = await refreshAccessToken(envRefresh);
  cachedTokens = bundle;
  return bundle.accessToken;
}

export type NormalizedArticle = {
  title: string;
  url: string;
  source: string;
  pubDate: string;
};

function itemToArticle(item: InoreaderStreamItem): NormalizedArticle | null {
  const title = item.title?.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const fromCanonical = item.canonical?.[0]?.href?.trim();
  const htmlAlt = item.alternate?.find((a) => a.type === "text/html")?.href?.trim();
  const firstAlt = item.alternate?.[0]?.href?.trim();
  const url = fromCanonical || htmlAlt || firstAlt;
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const source = item.origin?.title?.trim() || "Inoreader";
  const pubDate =
    typeof item.published === "number" && item.published > 0
      ? new Date(item.published * 1000).toUTCString()
      : "";

  return { title, url, source, pubDate };
}

/**
 * Fetch newest items from a stream (folder label, single feed, or reading list).
 * @param streamId e.g. user/-/label/Environmental blogs or feed/http://example.com/rss
 * @param maxItems capped at 100 per Inoreader API
 */
export async function fetchInoreaderStreamArticles(
  streamId: string,
  maxItems: number
): Promise<NormalizedArticle[]> {
  const token = await getValidAccessToken();
  const n = Math.min(Math.max(1, maxItems), 100);
  const encoded = encodeURIComponent(streamId);
  const url = `${INOREADER_ORIGIN}/reader/api/0/stream/contents/${encoded}?n=${n}&output=json`;

  const res = await fetch(url, { headers: inoreaderHeaders(token) });
  const text = await res.text();

  let json: InoreaderStreamResponse;
  try {
    json = text ? (JSON.parse(text) as InoreaderStreamResponse) : {};
  } catch {
    throw new Error(`Inoreader stream response was not JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const err = (json as { error?: string }).error ?? text.slice(0, 300);
    throw new Error(`Inoreader stream contents failed (HTTP ${res.status}): ${err}`);
  }

  const items = Array.isArray(json.items) ? json.items : [];
  const out: NormalizedArticle[] = [];
  for (const item of items) {
    const a = itemToArticle(item);
    if (a) out.push(a);
  }

  out.sort((a, b) => {
    const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tb - ta;
  });

  return out;
}
