import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { serverEnv } from "@/lib/env";

/** Service-role client. Bypasses RLS: use only in server code, after checking who is asking. */
export function createAdminClient() {
  const key = serverEnv().serviceRoleKey;
  if (!SUPABASE_URL || !key) throw new Error("service role is not configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
