import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Server-side only. Bypasses RLS. Use for API routes that manage wp_sites. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for server-side wp_sites operations");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side wp_sites operations");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
