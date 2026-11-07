import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLineItems, totalThb, type LineItem, type PackageKind } from "@/lib/pricing";
import { CODE_RE, applyDiscount, codeProblem, discountAmount, normalizeCode, type CodeRow } from "./rules";

const db = () => createAdminClient();
const COLS = "id, code, kind, value, active, valid_from, valid_to, max_uses, per_user";

export type Priced = { ok: true; items: LineItem[]; codeId: string; code: string; discountThb: number; totalThb: number } | { ok: false; error: string };

/** Checks the code for this person and takes it off the service-fee lines. Nothing is reserved here (see reserve): this is also what the "Apply" button shows. */
export async function priceWithCode(userId: string, items: LineItem[], codeRaw: string): Promise<Priced> {
  const code = normalizeCode(codeRaw); if (!CODE_RE.test(code)) return { ok: false, error: "err_discount_invalid" };
  const { data: row } = await db().from("discount_codes").select(COLS).eq("code", code).maybeSingle();
  const c = row as CodeRow | null;
  const [{ count: used }, { count: mine }] = c ? await Promise.all([
    db().from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", c.id),
    db().from("discount_redemptions").select("id", { count: "exact", head: true }).eq("code_id", c.id).eq("owner_id", userId),
  ]) : [{ count: 0 }, { count: 0 }];
  const problem = codeProblem(c, new Date(), used ?? 0, mine ?? 0); if (problem || !c) return { ok: false, error: problem ?? "err_discount_invalid" };
  const base = items.filter((i) => i.kind === "service_fee").reduce((t, i) => t + i.amountThb, 0), d = discountAmount(c, base);
  if (d <= 0) return { ok: false, error: "err_discount_none" };
  const out = applyDiscount(items, c.code, d);
  return { ok: true, items: out, codeId: c.id, code: c.code, discountThb: d, totalThb: totalThb(out) };
}

/** Takes the use for this payment (atomic in the database, limits included). Anything but "ok" means the payment must not go ahead. */
export async function reserveDiscount(codeId: string, userId: string, paymentId: string, amountThb: number): Promise<string> {
  const { data, error } = await db().rpc("reserve_discount", { p_code_id: codeId, p_owner: userId, p_payment: paymentId, p_amount: amountThb });
  if (error) { console.error("[discount] reserve failed", error.message); return "err_generic"; }
  return String(data);
}
/** A payment that did not go through gives its use back. */
export const releaseDiscount = (paymentId: string) => db().from("discount_redemptions").delete().eq("payment_id", paymentId);

/** What the "Apply" button shows: the lines of this trip's checkout with the code taken off (the same lines the real checkout builds). */
export async function quoteForTrip(userId: string, tripId: string, codeRaw: string): Promise<{ ok: true; discountThb: number; totalThb: number; code: string } | { ok: false; error: string }> {
  const { data: apps } = await db().from("applications").select("id, ref_no, package, visa_fee_thb, service_fee_thb, traveler_id").eq("trip_id", tripId).eq("owner_id", userId).in("status", ["draft", "awaiting_payment"]);
  if (!apps?.length) return { ok: false, error: "err_nothing_to_pay" };
  const { data: addons } = await db().from("addon_orders").select("id, application_id, package_name, price_thb").in("application_id", apps.map((a) => a.id)).eq("status", "pending_payment");
  const items = buildLineItems(apps.map((a) => ({ id: a.id, package: a.package as PackageKind, travelerName: a.ref_no, visaFeeThb: a.visa_fee_thb, serviceFeeThb: a.service_fee_thb })), (addons ?? []).map((x) => ({ id: x.id, applicationId: x.application_id, name: x.package_name, priceThb: Number(x.price_thb) })));
  const r = await priceWithCode(userId, items, codeRaw);
  return r.ok ? { ok: true, discountThb: r.discountThb, totalThb: r.totalThb, code: r.code } : r;
}
