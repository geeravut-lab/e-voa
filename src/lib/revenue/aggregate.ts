// Adds up revenue by category and by time bucket. Pure (no database). Money is whole baht or baht with satang; sums are rounded to satang.
import { bucketKey, bucketKeys, type Range } from "./range";

export type RevenueCategory = "evoa" | "insurance" | "sim" | "vip" | "health";
export const REVENUE_CATEGORIES: RevenueCategory[] = ["evoa", "insurance", "sim", "vip", "health"];
/** add-on category (as stored on addon_orders) → revenue category */
export const categoryOfAddon = (c: string | null | undefined): RevenueCategory => (c === "insurance" ? "insurance" : c === "sim" || c === "esim" ? "sim" : c === "vip" ? "vip" : c === "health" ? "health" : "evoa");

export type PaidLine = { paymentId: string; at: string; receiptNo: string | null; reference: string; category: RevenueCategory; label: string; amountThb: number };
export type RefundLine = { refundId: string; at: string; receiptNo: string | null; reference: string; category: RevenueCategory; reason: string; amountThb: number };
export type Split = Record<RevenueCategory, number>;
const zero = (): Split => ({ evoa: 0, insurance: 0, sim: 0, vip: 0, health: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;

export type Summary = {
  gross: number; refunds: number; net: number; payments: number;
  byCategory: Record<RevenueCategory, { gross: number; refunds: number; net: number }>;
  series: { key: string; gross: Split; net: Split; total: number }[];
};

export function summarize(paid: PaidLine[], refunds: RefundLine[], range: Range): Summary {
  const byCategory = Object.fromEntries(REVENUE_CATEGORIES.map((c) => [c, { gross: 0, refunds: 0, net: 0 }])) as Summary["byCategory"];
  const keys = bucketKeys(range), series = new Map(keys.map((k) => [k, { key: k, gross: zero(), net: zero(), total: 0 }]));
  const slot = (iso: string) => series.get(bucketKey(new Date(iso), range.bucket));
  for (const l of paid) { byCategory[l.category].gross += l.amountThb; const s = slot(l.at); if (s) { s.gross[l.category] += l.amountThb; s.net[l.category] += l.amountThb; } }
  for (const l of refunds) { byCategory[l.category].refunds += l.amountThb; const s = slot(l.at); if (s) s.net[l.category] -= l.amountThb; }
  for (const c of REVENUE_CATEGORIES) { byCategory[c].gross = r2(byCategory[c].gross); byCategory[c].refunds = r2(byCategory[c].refunds); byCategory[c].net = r2(byCategory[c].gross - byCategory[c].refunds); }
  const out = [...series.values()].map((s) => { for (const c of REVENUE_CATEGORIES) { s.gross[c] = r2(s.gross[c]); s.net[c] = r2(s.net[c]); } return { ...s, total: r2(REVENUE_CATEGORIES.reduce((n, c) => n + s.net[c], 0)) }; });
  const gross = r2(REVENUE_CATEGORIES.reduce((n, c) => n + byCategory[c].gross, 0)), ref = r2(REVENUE_CATEGORIES.reduce((n, c) => n + byCategory[c].refunds, 0));
  return { gross, refunds: ref, net: r2(gross - ref), payments: new Set(paid.map((l) => l.paymentId)).size, byCategory, series: out };
}

const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The export file: one row per paid line and one (negative) row per refund, in time order, ending with the totals. Opens correctly in Excel (BOM). */
export function revenueCsv(paid: PaidLine[], refunds: RefundLine[]): string {
  const head = ["type", "date_time_bangkok", "receipt_no", "reference", "category", "description", "amount_thb"];
  const th = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().replace("T", " ").slice(0, 19);
  const rows = [
    ...paid.map((l) => ({ at: l.at, row: ["payment", th(l.at), l.receiptNo ?? "", l.reference, l.category, l.label, l.amountThb.toFixed(2)] })),
    ...refunds.map((l) => ({ at: l.at, row: ["refund", th(l.at), l.receiptNo ?? "", l.reference, l.category, l.reason, (-l.amountThb).toFixed(2)] })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const gross = paid.reduce((n, l) => n + l.amountThb, 0), ref = refunds.reduce((n, l) => n + l.amountThb, 0);
  return "﻿" + [head.join(","), ...rows.map((x) => x.row.map(cell).join(",")), ["total_net", "", "", "", "", `gross ${gross.toFixed(2)} - refunds ${ref.toFixed(2)}`, r2(gross - ref).toFixed(2)].map(cell).join(",")].join("\n") + "\n";
}
