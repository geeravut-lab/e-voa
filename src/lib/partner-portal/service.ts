import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import { PartnerError } from "@/lib/partners/client";
import { CATEGORIES_OF, PRICE_MAX, PRICE_MIN, categoryAllowed, isPartnerKind, newVoucherCode, normalizeVoucher, partnerShare, periodRange, type PartnerKind, type SettlementLine } from "./rules";

const db = () => createAdminClient();
export type Partner = { id: string; name: string; provider: PartnerKind; status: "pending" | "active" | "suspended"; portal_managed: boolean; settlement_pct: number; contact_email: string | null };

export async function membershipOf(userId: string): Promise<{ partner: Partner; role: "owner" | "staff" } | null> {
  const { data } = await db().from("partner_members").select("role, partners(id, name, provider, status, portal_managed, settlement_pct, contact_email)").eq("user_id", userId).limit(1).maybeSingle();
  const p = data?.partners as unknown as Partner | null;
  return data && p ? { partner: { ...p, settlement_pct: Number(p.settlement_pct) }, role: data.role as "owner" | "staff" } : null;
}

const Apply = z.object({ name: z.string().trim().min(2).max(120), provider: z.string().refine(isPartnerKind), contact_name: z.string().trim().min(2).max(100), contact_email: z.string().trim().email().max(100), contact_phone: z.string().trim().min(5).max(30) });

/** A company asks to sell through ThaiPass. It stays "pending" (nothing is offered to travelers) until staff approve it. */
export async function applyForPartner(userId: string, input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = Apply.safeParse(input); if (!p.success) return { ok: false, error: "err_form_incomplete" };
  if (await membershipOf(userId)) return { ok: false, error: "err_partner_exists" };
  const ins = await db().from("partners").insert({ ...p.data, created_by: userId, status: "pending" }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, error: "err_generic" };
  const mem = await db().from("partner_members").insert({ partner_id: ins.data.id, user_id: userId, role: "owner" }).select("user_id");
  if (mem.error) { await db().from("partners").delete().eq("id", ins.data.id); return { ok: false, error: "err_generic" }; }
  await audit({ actorId: userId, action: "partner.apply", entity: "partner", entityId: ins.data.id });
  return { ok: true, id: ins.data.id };
}

export async function addMember(ownerId: string, partnerId: string, emailRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await db().from("partner_members").select("role").eq("partner_id", partnerId).eq("user_id", ownerId).maybeSingle();
  if (me.data?.role !== "owner") return { ok: false, error: "err_forbidden" };
  const email = emailRaw.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "err_email_invalid" };
  const { data: prof } = await db().from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!prof) return { ok: false, error: "err_agency_no_account" };
  if (await membershipOf(prof.id)) return { ok: false, error: "err_partner_exists" };
  const ins = await db().from("partner_members").insert({ partner_id: partnerId, user_id: prof.id, role: "staff" }).select("user_id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: ownerId, action: "partner.member.add", entity: "partner", entityId: partnerId });
  return { ok: true };
}
export async function removeMember(ownerId: string, partnerId: string, userId: string): Promise<boolean> {
  const me = await db().from("partner_members").select("role").eq("partner_id", partnerId).eq("user_id", ownerId).maybeSingle();
  if (me.data?.role !== "owner" || userId === ownerId) return false;
  const del = await db().from("partner_members").delete().eq("partner_id", partnerId).eq("user_id", userId).select("user_id");
  if (del.data?.length) await audit({ actorId: ownerId, action: "partner.member.remove", entity: "partner", entityId: partnerId });
  return (del.data?.length ?? 0) > 0;
}
export async function membersOf(partnerId: string) {
  const { data } = await db().from("partner_members").select("user_id, role, created_at").eq("partner_id", partnerId).order("created_at");
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: profs } = ids.length ? await db().from("profiles").select("id, email, display_name").in("id", ids) : { data: [] };
  return (data ?? []).map((m) => ({ ...m, email: profs?.find((p) => p.id === m.user_id)?.email ?? "", name: profs?.find((p) => p.id === m.user_id)?.display_name ?? "" }));
}

// ------------------------------------------------------------------ packages
const Pkg = z.object({
  category: z.string(), name: z.string().trim().min(2).max(120), detail: z.string().trim().max(600).default(""), terms: z.string().trim().max(600).default(""),
  price_thb: z.coerce.number().int().min(PRICE_MIN).max(PRICE_MAX), price_usd: z.coerce.number().min(0).max(5000).optional(), price_cny: z.coerce.number().min(0).max(40000).optional(),
  active: z.boolean().default(true),
});

/** The owner of an active partner creates (no code) or edits (code) a package. Prices of orders already placed never change: an order keeps the price it was bought at. */
export async function savePackage(userId: string, input: unknown, code?: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const m = await membershipOf(userId);
  if (!m || m.role !== "owner") return { ok: false, error: "err_forbidden" };
  if (m.partner.status !== "active" || !m.partner.portal_managed) return { ok: false, error: "err_forbidden" };
  const p = Pkg.safeParse(input); if (!p.success) return { ok: false, error: "err_form_incomplete" };
  if (!categoryAllowed(m.partner.provider, p.data.category)) return { ok: false, error: "err_generic" };
  const row = { category: p.data.category, name: p.data.name, detail: p.data.detail || null, terms: p.data.terms || null, price_thb: p.data.price_thb, price_usd: p.data.price_usd ?? null, price_cny: p.data.price_cny ?? null, active: p.data.active, synced_at: new Date().toISOString() };
  if (code) {
    const upd = await db().from("partner_packages").update(row).eq("provider", m.partner.provider).eq("package_code", code).eq("partner_id", m.partner.id).eq("source", "portal").select("package_code");
    if (upd.data?.length !== 1) return { ok: false, error: "err_not_found" };
    await audit({ actorId: userId, action: "partner.package.update", entity: "partner", entityId: m.partner.id, detail: { code, price: p.data.price_thb, active: p.data.active } });
    return { ok: true, code };
  }
  const newCode = `PP-${m.partner.id.slice(0, 4).toUpperCase()}-${newVoucherCode().slice(3)}`;
  const ins = await db().from("partner_packages").insert({ ...row, provider: m.partner.provider, package_code: newCode, partner_id: m.partner.id, source: "portal" }).select("package_code");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: userId, action: "partner.package.create", entity: "partner", entityId: m.partner.id, detail: { code: newCode, price: p.data.price_thb } });
  return { ok: true, code: newCode };
}
export async function packagesOf(partnerId: string) {
  const { data } = await db().from("partner_packages").select("package_code, category, name, detail, terms, price_thb, price_usd, price_cny, active").eq("partner_id", partnerId).eq("source", "portal").order("synced_at", { ascending: false });
  return (data ?? []).map((x) => ({ ...x, price_thb: Number(x.price_thb) }));
}

// ------------------------------------------------------------------ fulfilment (called by issueAddon)
/** If the package belongs to a portal-managed partner, "issue" it here: a voucher code the traveler shows at the counter. Returns null for packages bought through a partner API. */
export async function issueViaPortal(order: { id: string; category: string; package_code: string }): Promise<{ partner_id: string; partner_ref: Record<string, unknown>; delivery: Record<string, unknown> } | null> {
  const provider = order.category === "insurance" ? "insurance" : order.category === "sim" || order.category === "esim" ? "sim" : order.category === "vip" ? "vip" : "bhs";
  const { data: pk } = await db().from("partner_packages").select("partner_id, source, partners(status, portal_managed)").eq("provider", provider).eq("package_code", order.package_code).maybeSingle();
  if (!pk || pk.source !== "portal" || !pk.partner_id) return null;
  const pt = pk.partners as unknown as { status: string; portal_managed: boolean } | null;
  if (!pt || pt.status !== "active" || !pt.portal_managed) throw new PartnerError("refused", "the partner is not active");        // refused → failed → refunded automatically
  for (let i = 0; i < 5; i++) {
    const code = newVoucherCode();
    const { count } = await db().from("addon_orders").select("id", { count: "exact", head: true }).eq("partner_ref->>portal_code", code);
    if (!count) return { partner_id: pk.partner_id, partner_ref: { portal_code: code }, delivery: { voucher_code: code, pickup: "show the code and your passport to the partner" } };
  }
  throw new PartnerError("unavailable", "could not make a unique voucher code");        // retried later
}

// ------------------------------------------------------------------ redeeming
/** The partner's staff enter the code the traveler shows. Only an issued order of THIS partner can be redeemed, once. */
export async function redeemVoucher(userId: string, raw: string): Promise<{ ok: true; item: string } | { ok: false; error: string }> {
  const m = await membershipOf(userId);
  if (!m || m.partner.status !== "active") return { ok: false, error: "err_forbidden" };
  const code = normalizeVoucher(raw); if (!code) return { ok: false, error: "err_voucher_invalid" };
  const { data: o } = await db().from("addon_orders").select("id, owner_id, application_id, package_name, category, status, partner_id").eq("partner_ref->>portal_code", code).maybeSingle();
  if (!o || o.partner_id !== m.partner.id) return { ok: false, error: "err_voucher_invalid" };          // another partner's code looks exactly like an unknown one
  if (o.status === "used") return { ok: false, error: "err_voucher_used" };
  if (o.status !== "issued") return { ok: false, error: "err_voucher_invalid" };            // refunded / cancelled orders cannot be redeemed
  const upd = await db().from("addon_orders").update({ status: "used", used_at: new Date().toISOString() }).eq("id", o.id).eq("status", "issued").select("id");
  if (upd.data?.length !== 1) return { ok: false, error: "err_voucher_used" };                // somebody else redeemed it a moment ago
  const { data: prof } = await db().from("profiles").select("lang").eq("id", o.owner_id).maybeSingle();
  const t = DICTS[isLang(prof?.lang) ? prof.lang : "en"];
  await notifyUser({ userId: o.owner_id, title: t.notif_addon_used_title, body: fmt(t.notif_addon_used_body, { item: o.package_name }), link: `/trips/${o.application_id}`, kind: "addon.used", dedupeKey: `addon:${o.id}:used` });
  await audit({ actorId: userId, action: "partner.redeem", entity: "addon_order", entityId: o.id, detail: { partner: m.partner.id } });
  return { ok: true, item: o.package_name };
}

// ------------------------------------------------------------------ money
/** Redeemed orders of one month that are not settled yet, with the partner's share at the agreed rate. Refunded orders are never "used", so they never appear. */
export async function settlementLines(partnerId: string, period: string, pct: number, onlyOpen = true): Promise<SettlementLine[]> {
  const { from, to } = periodRange(period);
  let q = db().from("addon_orders").select("id, price_thb, package_name, used_at, partner_ref, application_id").eq("partner_id", partnerId).eq("status", "used").gte("used_at", from.toISOString()).lt("used_at", to.toISOString()).order("used_at");
  if (onlyOpen) q = q.is("settlement_id", null);
  const { data } = await q;
  const apps = (data ?? []).length ? (await db().from("applications").select("id, ref_no").in("id", data!.map((x) => x.application_id))).data ?? [] : [];
  return (data ?? []).map((x) => ({ usedAt: String(x.used_at).slice(0, 10), reference: apps.find((a) => a.id === x.application_id)?.ref_no ?? "", code: String((x.partner_ref as { portal_code?: string }).portal_code ?? ""), item: x.package_name, priceThb: Number(x.price_thb), shareThb: partnerShare(Number(x.price_thb), pct) }));
}
export async function partnerStats(partnerId: string, pct: number, period: string) {
  const lines = await settlementLines(partnerId, period, pct, false);
  const { count: waiting } = await db().from("addon_orders").select("id", { count: "exact", head: true }).eq("partner_id", partnerId).eq("status", "issued");
  return { redeemed: lines.length, grossThb: lines.reduce((s, l) => s + l.priceThb, 0), shareThb: Math.round(lines.reduce((s, l) => s + l.shareThb, 0) * 100) / 100, waiting: waiting ?? 0 };
}

/** Staff record that a month was paid out to the partner: the redeemed orders are tied to the settlement so they are never counted twice. */
export async function closeSettlement(adminId: string, partnerId: string, period: string, note: string): Promise<{ ok: true; orders: number; partnerThb: number } | { ok: false; error: string }> {
  const { data: p } = await db().from("partners").select("settlement_pct").eq("id", partnerId).maybeSingle();
  if (!p) return { ok: false, error: "err_not_found" };
  const lines = await settlementLines(partnerId, period, Number(p.settlement_pct));
  if (lines.length === 0) return { ok: false, error: "err_nothing_to_settle" };
  const gross = lines.reduce((s, l) => s + l.priceThb, 0), share = Math.round(lines.reduce((s, l) => s + l.shareThb, 0) * 100) / 100;
  const ins = await db().from("partner_settlements").insert({ partner_id: partnerId, period, orders: lines.length, gross_thb: gross, partner_thb: share, paid_by: adminId, note: note.slice(0, 300) || null }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: ins.error?.code === "23505" ? "err_settled_already" : "err_generic" };
  const { from, to } = periodRange(period);
  const tie = await db().from("addon_orders").update({ settlement_id: ins.data[0].id }).eq("partner_id", partnerId).eq("status", "used").is("settlement_id", null).gte("used_at", from.toISOString()).lt("used_at", to.toISOString()).select("id");
  if ((tie.data?.length ?? 0) !== lines.length) {
    // orders redeemed between the two reads would be missing from the totals: undo, and let staff try again
    await db().from("addon_orders").update({ settlement_id: null }).eq("settlement_id", ins.data[0].id);
    await db().from("partner_settlements").delete().eq("id", ins.data[0].id);
    return { ok: false, error: "err_conflict" };
  }
  await audit({ actorId: adminId, actorRole: "admin", action: "partner.settle", entity: "partner", entityId: partnerId, detail: { period, orders: lines.length, partnerThb: share } });
  return { ok: true, orders: lines.length, partnerThb: share };
}
export { CATEGORIES_OF };
