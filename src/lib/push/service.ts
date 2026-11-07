import "server-only";
import * as webpush from "web-push";
import { envValue, SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPayload, isGone, parseSubscription, type PushSub } from "./rules";

/** Web Push needs a key pair (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). Without them the switch is simply not shown. */
export const pushPublicKey = () => envValue("VAPID_PUBLIC_KEY");
export const pushConfigured = () => Boolean(pushPublicKey() && envValue("VAPID_PRIVATE_KEY"));
const subject = () => envValue("VAPID_SUBJECT") || SITE_URL;
const db = () => createAdminClient();

export async function saveSubscription(userId: string, raw: unknown): Promise<boolean> {
  const s = parseSubscription(raw); if (!s) return false;
  const r = await db().from("push_subscriptions").upsert({ user_id: userId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, fail_count: 0 }, { onConflict: "endpoint" }).select("id");
  return !r.error && r.data?.length === 1;
}
export async function removeSubscription(userId: string, endpoint: string): Promise<void> { await db().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint); }
export async function hasSubscription(userId: string): Promise<boolean> {
  const { count, error } = await db().from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return !error && (count ?? 0) > 0;
}

type Row = PushSub & { id: string };
/** Sends one notice to every phone/browser the person switched on. Best effort: never throws; a dead subscription is removed, a flaky one is counted. */
export async function pushToUser(userId: string, n: { title: string; body?: string; link?: string; kind?: string; dedupeKey?: string }): Promise<number> {
  if (!pushConfigured()) return 0;
  try {
    const { data, error } = await db().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(10);
    if (error || !data?.length) return 0;
    webpush.setVapidDetails(subject(), pushPublicKey(), envValue("VAPID_PRIVATE_KEY"));
    const body = JSON.stringify(buildPayload(n));
    let ok = 0;
    await Promise.all((data as Row[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "normal", timeout: 8000 });
        ok++; await db().from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), fail_count: 0 }).eq("id", s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? 0;
        if (isGone(status)) await db().from("push_subscriptions").delete().eq("id", s.id);
        else {
          const { data: cur } = await db().from("push_subscriptions").select("fail_count").eq("id", s.id).maybeSingle();
          const fails = Number(cur?.fail_count ?? 0) + 1;
          if (fails >= 10) await db().from("push_subscriptions").delete().eq("id", s.id); else await db().from("push_subscriptions").update({ fail_count: fails }).eq("id", s.id);
        }
      }
    }));
    return ok;
  } catch (e) { console.error("[push] send failed", (e as Error).message); return 0; }
}
