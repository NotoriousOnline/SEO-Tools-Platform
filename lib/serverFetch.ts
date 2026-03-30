/**
 * Node's undici fetch often fails with TypeError: fetch failed when the request
 * URL uses "localhost" (resolves to ::1) while the dev server only listens on IPv4.
 */
export function serverFetchOrigin(requestUrl: string): string {
  const u = new URL(requestUrl);
  if (u.hostname === "localhost" || u.hostname === "::1") {
    u.hostname = "127.0.0.1";
  }
  if (u.hostname === "0.0.0.0") {
    u.hostname = "127.0.0.1";
  }
  return u.origin;
}

/** Surfaces undici's nested cause (e.g. ECONNREFUSED, CERT_HAS_EXPIRED). */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const c = err.cause;
  if (c instanceof Error) {
    const code = "code" in c && typeof (c as { code?: string }).code === "string" ? ` (${(c as { code: string }).code})` : "";
    return `${c.message}${code}`;
  }
  return err.message;
}

/** Error + cause chain and common @supabase/supabase-js fields (message, details, …). */
export function flattenErrorText(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth++ < 12) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      if (cur.stack) parts.push(cur.stack);
      cur = cur.cause;
      continue;
    }
    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      for (const k of ["message", "details", "hint", "code"]) {
        if (typeof o[k] === "string" && o[k]) parts.push(o[k] as string);
      }
      cur = o.cause;
      continue;
    }
    parts.push(String(cur));
    break;
  }
  return parts.join("\n");
}

/** User-facing hint when Supabase REST/auth fetch fails at DNS/TCP/TLS layer. */
export function explainSupabaseReachabilityError(err: unknown): string | null {
  const blob = flattenErrorText(err);
  if (/ENOTFOUND/i.test(blob) && /supabase\.co/i.test(blob)) {
    return (
      "Supabase hostname could not be resolved (DNS ENOTFOUND). In the Supabase dashboard open Project Settings → API and copy the exact Project URL into NEXT_PUBLIC_SUPABASE_URL in .env.local. " +
      "Fix typos, remove trailing spaces, and confirm the project exists and is not paused. If the URL is correct, try another network or disable VPN."
    );
  }
  if (/ECONNREFUSED/i.test(blob) && /supabase/i.test(blob)) {
    return "Connection to Supabase was refused. Check firewall, proxy, or whether outbound HTTPS is allowed.";
  }
  if (/fetch failed/i.test(blob) && /certificate|CERT|SSL|TLS|UNABLE_TO_VERIFY/i.test(blob)) {
    return "TLS error connecting to Supabase. Check system clock and any HTTPS-inspecting proxy.";
  }
  return null;
}
