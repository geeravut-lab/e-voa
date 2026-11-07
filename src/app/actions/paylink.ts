"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { limited, rateLimit } from "@/lib/ratelimit";
import { getLang } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { createPayLink, payLinkUrl, payViaLink, revokePayLink } from "@/lib/paylink/service";
import { recordConsent, decodeSignature } from "@/lib/compliance";
import type { ActionResult } from "@/components/ActionForm";

export type LinkResult = { ok: true; url: string; expiresAt: string } | { ok: false; error: string } | null;

/** The traveler signs (same consents and declaration as paying) and gets a link someone else can pay with. The consent is the traveler's own, so it is recorded now, before anybody pays. */
export async function createPayLinkAction(_p: LinkResult, fd: FormData): Promise<LinkResult> {
  const v = await requireUser("/trips");
  if (!(await rateLimit(`paylink:${v.user.id}`, 10, 3600))) return { ok: false, error: "err_rate_limited" };
  const tripId = String(fd.get("tripId") ?? ""), on = (k: string) => fd.get(k) === "on";
  const signature = decodeSignature(String(fd.get("signature") ?? "")), signerName = String(fd.get("signer_name") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return { ok: false, error: "err_not_found" };
  if (!on("consent_terms") || !on("consent_immigration") || !on("declare")) return { ok: false, error: "err_consent_required" };
  if (signerName.length < 2 || !signature) return { ok: false, error: "err_signature_required" };
  const db = createAdminClient();
  const { data: apps } = await db.from("applications").select("id").eq("trip_id", tripId).eq("owner_id", v.user.id).in("status", ["draft", "awaiting_payment"]);
  const { count: addonCount } = apps?.length ? await db.from("addon_orders").select("id", { count: "exact", head: true }).eq("owner_id", v.user.id).eq("status", "pending_payment").in("application_id", apps.map((a) => a.id)) : { count: 0 };
  if ((addonCount ?? 0) > 0 && !on("consent_partners")) return { ok: false, error: "err_consent_required" };
  const link = await createPayLink(v.user.id, tripId); if (!link.ok) return link;
  const c = await recordConsent(v.user.id, tripId, { signerName, signature, withPartners: (addonCount ?? 0) > 0 });
  if (!c.ok) { await revokePayLink(v.user.id, tripId); return { ok: false, error: c.error }; }
  await audit({ actorId: v.user.id, action: "consent.recorded", entity: "trip", entityId: tripId });
  return { ok: true, url: payLinkUrl(link.token), expiresAt: link.expiresAt };
}

export async function revokePayLinkAction(tripId: string): Promise<ActionResult> {
  const v = await requireUser("/trips");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return { ok: false, error: "err_not_found" };
  return (await revokePayLink(v.user.id, tripId)) ? { ok: true } : { ok: false, error: "err_generic" };
}

/** The person who got the link pressed "Pay": no account needed, the secret in the address is the permission. Limited per visitor so the secret cannot be guessed. */
export async function payViaLinkAction(token: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  if (await limited("paylink-pay", 20, 600)) return { ok: false, error: "err_rate_limited" };
  const r = await payViaLink(token, await getLang());
  if (!r.ok) return { ok: false, error: r.error === "err_incomplete" ? "err_paylink_incomplete" : r.error };
  redirect(r.url);
}
