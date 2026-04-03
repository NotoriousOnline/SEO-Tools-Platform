import { getSupabaseAdmin } from "@/lib/supabase";

export type ServerLogLevel = "error" | "warn" | "info";

const MAX_MESSAGE = 8000;
let appLogsTableUnavailable = false;

/**
 * Persists a log row to Supabase (app_logs) for the /logs dashboard.
 * Never throws; failures only go to console so API handlers keep working.
 */
export async function serverLog(input: {
  level: ServerLogLevel;
  source: string;
  message: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (appLogsTableUnavailable) return;
  const message = input.message.slice(0, MAX_MESSAGE);
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("app_logs").insert({
      level: input.level,
      source: input.source.slice(0, 256),
      message,
      meta: input.meta ?? null,
    });
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const missingTable =
        error.code === "PGRST205" ||
        msg.includes("could not find the table") ||
        (msg.includes("app_logs") && msg.includes("schema cache"));
      if (missingTable) {
        appLogsTableUnavailable = true;
        console.warn(
          '[serverLog] "app_logs" table missing. Skipping log writes. Run supabase/migrations/004_app_logs.sql.'
        );
        return;
      }
      console.error("[serverLog] Supabase insert failed:", error.message, input.source);
    }
  } catch (e) {
    console.error("[serverLog] skipped (Supabase unavailable or misconfigured):", e);
  }
}

/**
 * Human-readable error text for logging and API JSON responses.
 * SDKs often throw plain objects (not Error), which would otherwise become "[object Object]".
 */
export function errorMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const base = err.message?.trim() || err.name || "Error";
    if (err.cause !== undefined) {
      const c = errorMessage(err.cause);
      if (c && c !== "Unknown error") return `${base} (${c})`;
    }
    return base;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) return o.message;
    const nested = o.error;
    if (typeof nested === "string" && nested.length > 0) return nested;
    if (nested && typeof nested === "object") {
      const e = nested as Record<string, unknown>;
      if (typeof e.message === "string" && e.message.length > 0) return e.message;
      if (typeof e.detail === "string") return e.detail;
    }
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}") return s.length > 2000 ? `${s.slice(0, 2000)}…` : s;
    } catch {
      /* circular or non-serializable */
    }
  }
  return String(err);
}
