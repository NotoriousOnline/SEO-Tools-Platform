import { NextResponse } from "next/server";
import { describeFetchError, explainSupabaseReachabilityError } from "@/lib/serverFetch";
import { errorMessage, serverLog } from "@/lib/serverLog";
import { wpRestHeaders } from "@/lib/wordpressClient";
import { createSite, getSites, type CreateSiteData, type WPToolScope } from "@/lib/wpSites";

const MASKED_PASSWORD = "••••••••";

function maskSite<T extends { app_password?: string }>(site: T): Omit<T, "app_password"> & { app_password: string } {
  return { ...site, app_password: MASKED_PASSWORD };
}

async function testWordPressConnection(
  url: string,
  username: string,
  app_password: string
): Promise<{ ok: boolean; detail?: string }> {
  const base = url.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: wpRestHeaders({ url, username, app_password }),
    });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const detail = describeFetchError(err);
    console.error("[sites] WordPress fetch:", detail);
    return { ok: false, detail };
  }
}

export async function handleSitesGET(scope: WPToolScope) {
  try {
    const sites = await getSites(scope);
    return NextResponse.json(sites.map(maskSite));
  } catch (err) {
    console.error("[sites] GET error:", err);
    void serverLog({
      level: "error",
      source: "wp_sites/GET",
      message: errorMessage(err),
    });
    const supabaseHint = explainSupabaseReachabilityError(err);
    if (supabaseHint) {
      return NextResponse.json({ error: supabaseHint }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }
}

export async function handleSitesPOST(request: Request, scope: WPToolScope) {
  try {
    const body = await request.json();
    const { name, url, username, app_password, tone_prompt } = body;

    if (!name || !url || !username || !app_password) {
      return NextResponse.json(
        { error: "Missing required fields: name, url, username, app_password" },
        { status: 400 }
      );
    }

    const conn = await testWordPressConnection(url, username, app_password);
    if (!conn.ok) {
      const hint = conn.detail ? ` (${conn.detail})` : "";
      const wafHint =
        /403/i.test(conn.detail ?? "")
          ? " HTTP 403 is often Cloudflare, Wordfence, or another WAF blocking your app server’s IP or “bot” requests—allowlist the server (e.g. Vercel egress IPs) or add a WAF rule to allow /wp-json/ for authenticated requests."
          : "";
      return NextResponse.json(
        {
          error: `Could not connect to WordPress${hint}.${wafHint} Use https:// in the site URL and verify the application password.`,
        },
        { status: 400 }
      );
    }

    const data: CreateSiteData = {
      name,
      url,
      username,
      app_password,
      tone_prompt: tone_prompt ?? undefined,
    };
    const site = await createSite(data, scope);
    return NextResponse.json(maskSite(site));
  } catch (err) {
    console.error("[sites] POST error:", err);
    void serverLog({
      level: "error",
      source: "wp_sites/POST",
      message: errorMessage(err),
    });
    const supabaseHint = explainSupabaseReachabilityError(err);
    if (supabaseHint) {
      return NextResponse.json({ error: supabaseHint }, { status: 503 });
    }
    const postgrest = err as { code?: string; message?: string };
    const msg =
      err instanceof Error
        ? err.message
        : typeof postgrest.message === "string"
          ? postgrest.message
          : String(err);
    if (msg.includes("NEXT_PUBLIC_SUPABASE_URL is required")) {
      return NextResponse.json(
        { error: "Server misconfiguration: set NEXT_PUBLIC_SUPABASE_URL in the environment." },
        { status: 503 }
      );
    }
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY is required")) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY (trim any spaces from .env). Required to save WordPress sites.",
        },
        { status: 503 }
      );
    }
    if (postgrest.code === "PGRST205" || msg.includes("Could not find the table")) {
      return NextResponse.json(
        {
          error:
            'Table "wp_sites" was not found. Run supabase/migrations/001_wp_sites.sql in the Supabase SQL editor, then try again.',
        },
        { status: 500 }
      );
    }
    if (msg.includes("tool_scope") || msg.includes("column")) {
      return NextResponse.json(
        {
          error:
            'Column "tool_scope" is missing. Run supabase/migrations/003_wp_sites_tool_scope.sql in the Supabase SQL editor.',
        },
        { status: 500 }
      );
    }
    if (msg.length > 0 && msg.length < 400) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to create site", details: msg }, { status: 500 });
  }
}
