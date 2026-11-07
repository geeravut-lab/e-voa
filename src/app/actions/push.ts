"use server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { pushConfigured, removeSubscription, saveSubscription } from "@/lib/push/service";
import type { ActionResult } from "@/components/ActionForm";

/** Switches phone notifications on for this browser. The subscription comes from the browser; the server checks its shape and its address before keeping it. */
export async function savePushAction(sub: unknown): Promise<ActionResult> {
  const v = await requireUser("/account/notifications");
  if (!pushConfigured()) return { ok: false, error: "err_not_configured" };
  if (!(await rateLimit(`push:${v.user.id}`, 10, 3600))) return { ok: false, error: "err_rate_limited" };
  return (await saveSubscription(v.user.id, sub)) ? { ok: true } : { ok: false, error: "err_generic" };
}
export async function removePushAction(endpoint: string): Promise<ActionResult> {
  const v = await requireUser("/account/notifications");
  if (typeof endpoint !== "string" || endpoint.length > 600) return { ok: false, error: "err_generic" };
  await removeSubscription(v.user.id, endpoint);
  return { ok: true };
}
