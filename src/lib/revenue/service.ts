import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LineItem } from "@/lib/pricing";
import { categoryOfAddon, type PaidLine, type RefundLine } from "./aggregate";
import type { Range } from "./range";

/**
 * What was paid and refunded in a range. Revenue counts when the payment was paid (paid_at) and refunds when they were made;
 * a payment is split into its lines (government visa fee, service fee, and each add-on in its own category). Never throws.
 */
export async function loadRevenue(range: Range): Promise<{ paid: PaidLine[]; refunds: RefundLine[]; truncated: boolean }> {
  const db = createAdminClient();
  const LIMIT = 20_000;
  const [{ data: pays }, { data: refs }] = await Promise.all([
    db.from("payments").select("id, receipt_no, paid_at, items").not("paid_at", "is", null).gte("paid_at", range.from.toISOString()).lt("paid_at", range.to.toISOString()).order("paid_at").limit(LIMIT),
    db.from("refunds").select("id, payment_id, addon_order_id, amount_thb, reason, created_at").eq("status", "succeeded").gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString()).order("created_at").limit(LIMIT),
  ]);
  const items = (p: { items: unknown }) => (Array.isArray(p.items) ? (p.items as LineItem[]) : []);
  const appIds = new Set<string>(), addonIds = new Set<string>();
  for (const p of pays ?? []) for (const i of items(p)) { if (i.applicationId) appIds.add(i.applicationId); if (i.addonOrderId) addonIds.add(i.addonOrderId); }
  for (const r of refs ?? []) if (r.addon_order_id) addonIds.add(r.addon_order_id);
  const [apps, addons, refPays] = await Promise.all([
    appIds.size ? db.from("applications").select("id, ref_no").in("id", [...appIds]) : Promise.resolve({ data: [] as { id: string; ref_no: string }[] }),
    addonIds.size ? db.from("addon_orders").select("id, category, application_id").in("id", [...addonIds]) : Promise.resolve({ data: [] as { id: string; category: string; application_id: string }[] }),
    (refs ?? []).length ? db.from("payments").select("id, receipt_no").in("id", [...new Set((refs ?? []).map((r) => r.payment_id))]) : Promise.resolve({ data: [] as { id: string; receipt_no: string | null }[] }),
  ]);
  const refOf = new Map((apps.data ?? []).map((a) => [a.id, a.ref_no]));
  const addonOf = new Map((addons.data ?? []).map((a) => [a.id, a]));
  const receiptOf = new Map((refPays.data ?? []).map((p) => [p.id, p.receipt_no]));
  const paid: PaidLine[] = [];
  for (const p of pays ?? []) for (const i of items(p)) {
    const category = i.kind === "addon" ? categoryOfAddon(addonOf.get(i.addonOrderId ?? "")?.category) : "evoa";
    paid.push({ paymentId: p.id, at: p.paid_at as string, receiptNo: p.receipt_no, reference: refOf.get(i.applicationId) ?? "", category, label: String(i.label ?? "").slice(0, 120), amountThb: Number(i.amountThb) });
  }
  const refunds: RefundLine[] = (refs ?? []).map((r) => {
    const a = r.addon_order_id ? addonOf.get(r.addon_order_id) : undefined;
    return { refundId: r.id, at: r.created_at, receiptNo: receiptOf.get(r.payment_id) ?? null, reference: a ? refOf.get(a.application_id) ?? "" : "", category: categoryOfAddon(a?.category), reason: String(r.reason ?? "").slice(0, 120), amountThb: Number(r.amount_thb) };
  });
  return { paid, refunds, truncated: (pays ?? []).length >= LIMIT || (refs ?? []).length >= LIMIT };
}
