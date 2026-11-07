// Discount codes: pure rules (no database). A code lowers the SERVICE fee only: the government visa fee and add-ons are never discounted.
import type { LineItem } from "@/lib/pricing";

export const CODE_RE = /^[A-Z0-9_-]{3,32}$/;
export const normalizeCode = (s: string) => String(s ?? "").replace(/\s+/g, "").toUpperCase();
export type DiscountRule = { kind: "percent" | "fixed"; value: number };

/** The most the code can take off: a percentage of the service fees (rounded down), or a fixed amount per payment, never more than the service fees. */
export function discountAmount(rule: DiscountRule, serviceFeeTotalThb: number): number {
  const base = Math.max(0, Math.floor(serviceFeeTotalThb)); if (!base || !Number.isFinite(rule.value) || rule.value <= 0) return 0;
  const raw = rule.kind === "percent" ? Math.floor((base * Math.min(rule.value, 100)) / 100) : Math.floor(rule.value);
  return Math.min(base, Math.max(0, raw));
}

/** Spreads the discount over the service-fee lines in proportion to their size (so each line stays a positive price, which Stripe needs). The lines add up exactly. */
export function applyDiscount(items: LineItem[], code: string, discountThb: number): LineItem[] {
  const idx = items.map((it, i) => (it.kind === "service_fee" ? i : -1)).filter((i) => i >= 0);
  const base = idx.reduce((t, i) => t + items[i].amountThb, 0), d = Math.min(Math.max(0, Math.floor(discountThb)), base);
  if (!d || !base) return items;
  const share = new Map<number, number>(); let used = 0;
  for (const i of idx) { const s = Math.floor((d * items[i].amountThb) / base); share.set(i, s); used += s; }
  for (let left = d - used, k = 0; left > 0 && k < idx.length * 2; k++) { const i = idx[k % idx.length]; if (share.get(i)! < items[i].amountThb) { share.set(i, share.get(i)! + 1); left--; } }
  return items.map((it, i) => (share.has(i) && share.get(i)! > 0 ? { ...it, amountThb: it.amountThb - share.get(i)!, label: `${it.label} · ${code}` } : it));
}

export type CodeRow = { id: string; code: string; kind: "percent" | "fixed"; value: number; active: boolean; valid_from: string | null; valid_to: string | null; max_uses: number | null; per_user: number };
/** Is the code usable now? Reasons are error codes for the screen. Which of "unknown" and "switched off" it was is never revealed (it stops people probing for codes). */
export function codeProblem(c: CodeRow | null, now: Date, used: number, usedByUser: number): string | null {
  if (!c || !c.active) return "err_discount_invalid";
  if ((c.valid_from && now < new Date(c.valid_from)) || (c.valid_to && now > new Date(c.valid_to))) return "err_discount_expired";
  if (c.max_uses !== null && used >= c.max_uses) return "err_discount_used_up";
  if (usedByUser >= c.per_user) return "err_discount_per_user";
  return null;
}
