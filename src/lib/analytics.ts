import "server-only";
import { hasServiceRole } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventName } from "@/config/events";

const seenToday = new Map<string, string>();   // userId -> yyyy-mm-dd already recorded by this instance

const bangkokDay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Records one usage event (name + optional short tag, no content). Never throws, never blocks the user. */
export async function trackEvent(userId: string, name: EventName, tag?: string): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    if (name === "active") {
      const day = bangkokDay();
      if (seenToday.get(userId) === day) return;
      seenToday.set(userId, day);
    }
    const safeTag = tag && /^[a-z0-9_]{1,40}$/.test(tag) ? tag : null;
    const { error } = await createAdminClient().from("product_events").insert({ user_id: userId, name, tag: safeTag });
    // 23505 = the once-a-day "active" row already exists: expected, not an error
    if (error && error.code !== "23505") console.error("[analytics] write failed", name, error.message);
  } catch (e) {
    console.error("[analytics] write failed", name, (e as Error).message);
  }
}
