import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { LOGS_COOKIE_NAME, verifyLogsSessionToken } from "@/lib/logsSession";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const password = process.env.LOGS_VIEWER_PASSWORD?.trim();
  if (!password) {
    return NextResponse.json(
      { error: "Logs viewer is disabled (set LOGS_VIEWER_PASSWORD)." },
      { status: 503 }
    );
  }

  const token = cookies().get(LOGS_COOKIE_NAME)?.value;
  if (!token || !verifyLogsSessionToken(token, password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 150));
  const level = searchParams.get("level");

  try {
    const sb = getSupabaseAdmin();
    let q = sb
      .from("app_logs")
      .select("id, created_at, level, source, message, meta")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (level === "error" || level === "warn" || level === "info") {
      q = q.eq("level", level);
    }

    const { data, error } = await q;

    if (error) {
      if (error.code === "PGRST205" || (error.message && error.message.includes("Could not find"))) {
        return NextResponse.json(
          {
            error:
              'Table "app_logs" was not found. Run supabase/migrations/004_app_logs.sql in the Supabase SQL editor.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
