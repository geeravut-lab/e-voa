// Daily reconciliation of OUR payment records against STRIPE's. Pure (no database, no network): the service gathers both sides, this file compares them.
// A day is a Thai calendar day. Stripe and we can record the same payment a few minutes (or, at midnight, a day) apart, so each side is looked up by its payment id,
// never matched by the day alone.
export type StripeCharge = { id: string; pi: string | null; amountThb: number; created: number; paid: boolean };      // created: unix seconds
export type StripeRefund = { id: string; pi: string | null; amountThb: number; created: number; status: string };
export type OurPayment = { id: string; pi: string | null; amountThb: number; status: string; paidAt: string | null; receipt: string | null };
export type OurRefund = { id: string; providerRefundId: string | null; amountThb: number; status: string; createdAt: string };

export type IssueKind = "stripe_only" | "ours_only" | "amount_mismatch" | "refund_stripe_only" | "refund_ours_only" | "refund_mismatch";
export type Issue = { kind: IssueKind; ref: string; stripeThb: number | null; oursThb: number | null };
export type Report = { day: string; stripeGrossThb: number; oursGrossThb: number; stripeRefundsThb: number; oursRefundsThb: number; stripeCount: number; oursCount: number; issues: Issue[] };

const PAID = new Set(["paid", "partially_refunded", "refunded"]);
export const isPaidStatus = (s: string) => PAID.has(s);

export type ReconcileInput = {
  day: string; from: Date; to: Date;                                      // the Thai day as [from, to)
  charges: StripeCharge[];                                                // Stripe charges around the day (a day of slack on each side)
  refunds: StripeRefund[];                                                // Stripe refunds around the day
  ours: OurPayment[];                                                     // our payments paid around the day, plus any payment a Stripe charge points to
  ourRefunds: OurRefund[];                                                // our refunds around the day
  stripeHasPi: Set<string>;                                               // payment ids Stripe confirmed to exist when asked directly (for ours-only candidates)
  stripeHasRefund: Set<string>;
};

const inDay = (ms: number, a: Date, b: Date) => ms >= a.getTime() && ms < b.getTime();

export function reconcile(i: ReconcileInput): Report {
  const issues: Issue[] = [];
  const oursByPi = new Map(i.ours.filter((o) => o.pi).map((o) => [o.pi!, o])), chargeByPi = new Map(i.charges.filter((c) => c.pi).map((c) => [c.pi!, c]));
  const stripeDay = i.charges.filter((c) => c.paid && inDay(c.created * 1000, i.from, i.to));
  const oursDay = i.ours.filter((o) => isPaidStatus(o.status) && o.paidAt && inDay(Date.parse(o.paidAt), i.from, i.to));
  for (const c of stripeDay) {
    const o = c.pi ? oursByPi.get(c.pi) : undefined;
    if (!o || !isPaidStatus(o.status)) issues.push({ kind: "stripe_only", ref: c.pi ?? c.id, stripeThb: c.amountThb, oursThb: o ? o.amountThb : null });
    else if (o.amountThb !== c.amountThb) issues.push({ kind: "amount_mismatch", ref: o.receipt ?? c.pi ?? c.id, stripeThb: c.amountThb, oursThb: o.amountThb });
  }
  for (const o of oursDay) {
    const known = o.pi && (chargeByPi.has(o.pi) || i.stripeHasPi.has(o.pi));
    if (!known) issues.push({ kind: "ours_only", ref: o.receipt ?? o.pi ?? o.id, stripeThb: null, oursThb: o.amountThb });
  }
  const ourRefundById = new Map(i.ourRefunds.filter((r) => r.providerRefundId).map((r) => [r.providerRefundId!, r]));
  const stripeRefundDay = i.refunds.filter((r) => r.status === "succeeded" && inDay(r.created * 1000, i.from, i.to));
  const ourRefundDay = i.ourRefunds.filter((r) => r.status === "succeeded" && inDay(Date.parse(r.createdAt), i.from, i.to));
  for (const r of stripeRefundDay) {
    const o = ourRefundById.get(r.id);
    if (!o) issues.push({ kind: "refund_stripe_only", ref: r.id, stripeThb: r.amountThb, oursThb: null });
    else if (o.amountThb !== r.amountThb) issues.push({ kind: "refund_mismatch", ref: r.id, stripeThb: r.amountThb, oursThb: o.amountThb });
  }
  const stripeRefundIds = new Set(i.refunds.map((r) => r.id));
  for (const o of ourRefundDay) if (o.providerRefundId && !stripeRefundIds.has(o.providerRefundId) && !i.stripeHasRefund.has(o.providerRefundId)) issues.push({ kind: "refund_ours_only", ref: o.providerRefundId, stripeThb: null, oursThb: o.amountThb });
  const sum = (xs: { amountThb: number }[]) => xs.reduce((t, x) => t + x.amountThb, 0);
  return { day: i.day, stripeGrossThb: sum(stripeDay), oursGrossThb: sum(oursDay), stripeRefundsThb: sum(stripeRefundDay), oursRefundsThb: sum(ourRefundDay), stripeCount: stripeDay.length, oursCount: oursDay.length, issues };
}

/** The Thai calendar day (yyyy-mm-dd) as [from, to): Thailand is UTC+7 all year. null when the text is not a real date. */
export function thaiDayRange(day: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number), from = new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
  return new Date(from.getTime() + 7 * 3_600_000).toISOString().slice(0, 10) === day ? { from, to: new Date(from.getTime() + 86_400_000) } : null;
}
export const yesterdayThai = (now = new Date()) => new Date(now.getTime() + 7 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function reportCsv(r: Report): string {
  const lines = ["day,kind,reference,stripe_thb,ours_thb", `${r.day},summary_stripe_gross,${r.stripeCount} payments,${r.stripeGrossThb},`, `${r.day},summary_ours_gross,${r.oursCount} payments,,${r.oursGrossThb}`, `${r.day},summary_refunds,,${r.stripeRefundsThb},${r.oursRefundsThb}`];
  for (const x of r.issues) lines.push(`${r.day},${x.kind},${q(x.ref)},${x.stripeThb ?? ""},${x.oursThb ?? ""}`);
  return lines.join("\r\n") + "\r\n";
}
