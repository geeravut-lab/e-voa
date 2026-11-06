import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// platform_settings is read often and changed rarely: cache per server instance for 30 s.
// Admin edits clear this instance's cache; other instances catch up within the TTL ("about a minute" on screen).
// Kept on globalThis because Next.js bundles server actions, pages and route handlers as separate module copies in one process:
// a plain module-level Map would be cleared in one copy and stay stale in the others (found by the browser end-to-end test).
const TTL_MS = Number(process.env.SETTINGS_TTL_MS) >= 0 && process.env.SETTINGS_TTL_MS ? Number(process.env.SETTINGS_TTL_MS) : 30_000;          // tests that change a setting behind the app's back shorten it
const g = globalThis as unknown as { __evoaSettingsCache?: Map<string, { at: number; value: unknown }> };
const cache = (g.__evoaSettingsCache ??= new Map<string, { at: number; value: unknown }>());

/** Reads one setting. Fails open: if the table or service key is unavailable the caller's fallback is used. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  if (!hasServiceRole()) return fallback;
  try {
    const { data, error } = await createAdminClient().from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    const value = (data?.value ?? fallback) as T;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error("[settings] read failed", key, (e as Error).message);
    return fallback;
  }
}

/** Writes one setting and returns whether exactly one row changed (an UPDATE that matches nothing is not success). */
export async function putSetting(key: string, value: unknown, userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: userId })
    .select("key");
  cache.delete(key);
  if (error) {
    console.error("[settings] write failed", key, error.message);
    return false;
  }
  return (data?.length ?? 0) === 1;
}

export const clearSettingCache = (key?: string) => (key ? cache.delete(key) : cache.clear());
