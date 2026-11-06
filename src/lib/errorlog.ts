import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Takes anything that could be personal out of an error text (e-mails, long numbers, tokens) before it is stored. */
export function scrub(s: string): string {
  return s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[token]").replace(/\d{6,}/g, "[number]").slice(0, 400);
}

/** Our own error record (no third party): shown to admins at /admin/errors. At most 120 rows per hour so a failing page cannot flood the table. Never throws. */
export async function logError(e: { route?: string; kind?: string; message: string; digest?: string }): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const db = createAdminClient();
    const ok = await db.rpc("rate_limit_hit", { p_key: "errorlog:global", p_window_s: 3600, p_limit: 120 });
    if (ok.data === false) return;
    await db.from("error_log").insert({ route: e.route?.slice(0, 120) ?? null, kind: e.kind?.slice(0, 40) ?? null, message: scrub(e.message), digest: e.digest?.slice(0, 40) ?? null });
  } catch { /* the log must never break the request */ }
}
