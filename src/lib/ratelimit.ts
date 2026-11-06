import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit counted by the database (so it holds across all server instances). Returns true when the call may go on.
 * Fails OPEN: if the counter cannot be read, the visitor is not blocked (rule 9), but the failure is logged.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!hasServiceRole()) return true;
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key.slice(0, 200), p_window_s: windowSeconds, p_limit: limit });
    if (error) { console.error("[ratelimit] failed", error.message); return true; }
    return data !== false;
  } catch (e) { console.error("[ratelimit] failed", (e as Error).message); return true; }
}

/** Who is asking, as a short hash (the address itself is never stored). Behind Vercel the first x-forwarded-for entry is the visitor. */
export async function clientId(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  return createHash("sha256").update(`thaipass:${ip}`).digest("hex").slice(0, 16);
}

/** Convenience for server actions and pages: limit per visitor (address) and per name. */
export async function limited(name: string, limit: number, windowSeconds: number, who?: string): Promise<boolean> {
  return !(await rateLimit(`${name}:${who ?? (await clientId())}`, limit, windowSeconds));
}
