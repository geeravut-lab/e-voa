// What may be refunded (decision Q4): only add-ons that have NOT been used. The visa fee and the service fee are not refunded, and the traveler is told before paying.
// The policy flags live in platform_settings.refund_policy. Pure.

export type RefundPolicy = { visa_fee_refundable: boolean; service_fee_refundable: boolean; unused_addons_refundable: boolean };
export const DEFAULT_REFUND_POLICY: RefundPolicy = { visa_fee_refundable: false, service_fee_refundable: false, unused_addons_refundable: true };
export const parseRefundPolicy = (v: unknown): RefundPolicy => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const b = (x: unknown, d: boolean) => (typeof x === "boolean" ? x : d);
  return { visa_fee_refundable: b(o.visa_fee_refundable, false), service_fee_refundable: b(o.service_fee_refundable, false), unused_addons_refundable: b(o.unused_addons_refundable, true) };
};

export type AddonState = { id: string; priceThb: number; refundedThb: number; status: "pending_payment" | "paid" | "issuing" | "issued" | "used" | "failed" | "refunded" | "cancelled" };

/** Amount that can still be refunded for one add-on under the policy (0 if used, already refunded, or not paid). */
export function refundableForAddon(a: AddonState, p: RefundPolicy): number {
  if (!p.unused_addons_refundable) return 0;
  if (!["paid", "issuing", "issued", "failed"].includes(a.status)) return 0;     // "used", "refunded", "cancelled", "pending_payment": nothing to give back
  return Math.max(0, Math.round((a.priceThb - a.refundedThb) * 100) / 100);
}

/** Never refund more than was paid minus what was already refunded. */
export const capRefund = (amountThb: number, paidThb: number, refundedThb: number) => Math.max(0, Math.min(amountThb, paidThb - refundedThb));

/** After Immigration rejects an application: which parts of the payment go back? */
export function refundOnRejection(a: { visaFeeThb: number; serviceFeeThb: number; addons: AddonState[] }, p: RefundPolicy): number {
  let sum = (p.visa_fee_refundable ? a.visaFeeThb : 0) + (p.service_fee_refundable ? a.serviceFeeThb : 0);
  for (const x of a.addons) sum += refundableForAddon(x, p);
  return Math.round(sum * 100) / 100;
}
