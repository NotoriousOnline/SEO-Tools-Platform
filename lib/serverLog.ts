import { getSupabaseAdmin } from "@/lib/supabase";

export type ServerLogLevel = "error" | "warn" | "info";

const MAX_MESSAGE = 8000;

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
      console.error("[serverLog] Supabase insert failed:", error.message, input.source);
    }
  } catch (e) {
    console.error("[serverLog] skipped (Supabase unavailable or misconfigured):", e);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
