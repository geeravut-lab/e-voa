import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { audit } from "@/lib/audit";
import { buildLineItems, totalThb, type PackageKind } from "@/lib/pricing";
import { loadRules } from "@/lib/rules/service";
import { expiresAt } from "@/lib/rules/rules";
import { startCheckout, type CheckoutResult } from "@/lib/payments/service";
import type { Lang } from "@/lib/i18n/langs";
import { hashToken, linkExpiry, linkState, newToken, shortName, validToken, type LinkState } from "./rules";

const db = () => createAdminClient();
const UNPAID = ["draft", "awaiting_payment"];

export const payLinkUrl = (token: string) => `${SITE_URL}/pay/link/${token}`;

export type OwnLink = { expiresAt: string };
/** The active link of a trip, if any (the secret is never stored, so only its expiry can be shown). */
export async function activeLink(ownerId: string, tripId: string): Promise<OwnLink | null> {
  const { data, error } = await db().from("payment_links").select("expires_at").eq("owner_id", ownerId).eq("trip_id", tripId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
  return error || !data?.[0] ? null : { expiresAt: data[0].expires_at as string };
}

/** Makes a new link for a trip that still has unpaid applications. An older active link for the same trip stops working. Returns the secret ONCE. */
export async function createPayLink(ownerId: string, tripId: string): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const { data: apps } = await db().from("applications").select("id, status, created_at, trips(arrival_date)").eq("owner_id", ownerId).eq("trip_id", tripId).in("status", UNPAID);
  if (!apps?.length) return { ok: false, error: "err_nothing_to_pay" };
  const cfg = await loadRules();
  const closes = Math.min(...apps.map((a) => { const t = a.trips as { arrival_date: string } | { arrival_date: string }[] | null; return expiresAt(a.created_at as string, (Array.isArray(t) ? t[0] : t)?.arrival_date ?? null, cfg); }));
  const now = new Date();
  if (closes <= now.getTime()) return { ok: false, error: "err_nothing_to_pay" };
  await db().from("payment_links").update({ revoked_at: now.toISOString() }).eq("owner_id", ownerId).eq("trip_id", tripId).is("revoked_at", null);
  const token = newToken(), exp = linkExpiry(now, Number.isFinite(closes) ? closes : undefined);
  const ins = await db().from("payment_links").insert({ owner_id: ownerId, trip_id: tripId, token_hash: hashToken(token), expires_at: exp.toISOString() }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: ownerId, action: "paylink.create", entity: "trip", entityId: tripId });
  return { ok: true, token, expiresAt: exp.toISOString() };
}
export async function revokePayLink(ownerId: string, tripId: string): Promise<boolean> {
  const r = await db().from("payment_links").update({ revoked_at: new Date().toISOString() }).eq("owner_id", ownerId).eq("trip_id", tripId).is("revoked_at", null).select("id");
  if (!r.error && (r.data?.length ?? 0) > 0) { await audit({ actorId: ownerId, action: "paylink.revoke", entity: "trip", entityId: tripId }); return true; }
  return false;
}

export type PayerView =
  | { ok: false; state: "invalid" | LinkState }
  | { ok: true; state: "active" | "paid"; payer: { by: string; arrival: string | null; lines: { label: string; thb: number }[]; totalThb: number; names: string[] } };

/** What the person who got the link may see: who asked, first names, the arrival date and the price lines. Nothing about passports or documents. */
export async function loadPayerView(token: unknown): Promise<PayerView> {
  if (!validToken(token)) return { ok: false, state: "invalid" };
  const { data: link } = await db().from("payment_links").select("id, owner_id, trip_id, expires_at, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link) return { ok: false, state: "invalid" };
  const st = linkState(link as { expires_at: string; revoked_at: string | null }, new Date());
  if (st !== "active") return { ok: false, state: st };
  const [{ data: apps }, { data: trip }, { data: prof }] = await Promise.all([
    db().from("applications").select("id, status, package, visa_fee_thb, service_fee_thb, traveler_id").eq("trip_id", link.trip_id).eq("owner_id", link.owner_id).neq("status", "cancelled"),
    db().from("trips").select("arrival_date").eq("id", link.trip_id).maybeSingle(),
    db().from("profiles").select("display_name").eq("id", link.owner_id).maybeSingle(),
  ]);
  const unpaid = (apps ?? []).filter((a) => UNPAID.includes(a.status as string));
  const by = (prof?.display_name as string | null)?.trim().split(/\s+/)[0] || "";
  if (unpaid.length === 0) return (apps ?? []).length > 0 ? { ok: true, state: "paid", payer: { by, arrival: trip?.arrival_date ?? null, lines: [], totalThb: 0, names: [] } } : { ok: false, state: "invalid" };
  const { data: trs } = await db().from("travelers").select("id, given_name, surname").in("id", unpaid.map((a) => a.traveler_id));
  const nameOf = (id: string) => { const t = trs?.find((x) => x.id === id); return t ? shortName(t.given_name, t.surname) : "—"; };
  const addons = (await db().from("addon_orders").select("id, application_id, package_name, price_thb").in("application_id", unpaid.map((a) => a.id)).eq("status", "pending_payment")).data ?? [];
  const items = buildLineItems(unpaid.map((a) => ({ id: a.id, package: a.package as PackageKind, travelerName: nameOf(a.traveler_id), visaFeeThb: a.visa_fee_thb, serviceFeeThb: a.service_fee_thb })), addons.map((x) => ({ id: x.id, applicationId: x.application_id, name: x.package_name, priceThb: Number(x.price_thb) })));
  let total = 0; try { total = totalThb(items); } catch { return { ok: false, state: "invalid" }; }
  return { ok: true, state: "active", payer: { by, arrival: trip?.arrival_date ?? null, lines: items.map((i) => ({ label: i.label, thb: i.amountThb })), totalThb: total, names: unpaid.map((a) => nameOf(a.traveler_id)) } };
}

/** The payer pressed "Pay": the same checkout the owner would get, started on the owner's behalf, returning to the public thank-you page. */
export async function payViaLink(token: unknown, lang: Lang): Promise<CheckoutResult> {
  if (!validToken(token)) return { ok: false, error: "err_paylink_unavailable" };
  const { data: link } = await db().from("payment_links").select("id, owner_id, trip_id, expires_at, revoked_at, uses").eq("token_hash", hashToken(token)).maybeSingle();
  if (!link || linkState(link as { expires_at: string; revoked_at: string | null }, new Date()) !== "active") return { ok: false, error: "err_paylink_unavailable" };
  const r = await startCheckout(link.owner_id as string, null, link.trip_id as string, lang, "", { returnPath: "/pay/thanks" });
  if (r.ok) {
    await db().from("payment_links").update({ last_used_at: new Date().toISOString(), uses: Number(link.uses ?? 0) + 1 }).eq("id", link.id);
    await audit({ actorId: null, actorRole: "visitor", action: "paylink.checkout", entity: "payment", entityId: r.paymentId });
  }
  return r;
}
