// Prices and which package is still possible. Pure: every number comes in as an argument (the admin edits them in /admin/settings).

export type Fees = { visa_thb: number; regular_service_thb: number; express_service_thb: number };
export type PackageKind = "regular" | "express";

export const REGULAR_MIN_HOURS = 72;   // "Regular: decision in 2–3 days" → must be ordered at least 72 h before landing
export const EXPRESS_MIN_HOURS = 24;   // "Express: decision within 24 h"

export const serviceFee = (fees: Fees, pkg: PackageKind) => (pkg === "express" ? fees.express_service_thb : fees.regular_service_thb);

/** What one traveler pays Immigration (visa) and us (service) for a package. */
export const applicationFees = (fees: Fees, pkg: PackageKind) => ({ visa: fees.visa_thb, service: serviceFee(fees, pkg), total: fees.visa_thb + serviceFee(fees, pkg) });

export type Availability = { hoursLeft: number; regular: boolean; express: boolean; reason: "ok" | "express_only" | "too_late" | "in_past" };

/** Which packages can still be decided in time? `arrivalAt` is the landing time as a Date (Thailand time converted by the caller). */
export function packageAvailability(now: Date, arrivalAt: Date): Availability {
  const hoursLeft = (arrivalAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft <= 0) return { hoursLeft, regular: false, express: false, reason: "in_past" };
  const regular = hoursLeft >= REGULAR_MIN_HOURS, express = hoursLeft >= EXPRESS_MIN_HOURS;
  return { hoursLeft, regular, express, reason: regular ? "ok" : express ? "express_only" : "too_late" };
}

/** Landing time from a date (yyyy-mm-dd) and local time (HH:MM, Thailand = UTC+7); missing time = end of the day (the safe side for "too late"). */
export function arrivalInstant(date: string, time?: string | null): Date {
  return new Date(`${date}T${time && /^\d{2}:\d{2}$/.test(time) ? time : "23:59"}:00+07:00`);
}

export type LineItem = { kind: "visa_fee" | "service_fee" | "addon"; applicationId: string; addonOrderId?: string; label: string; amountThb: number };

export function buildLineItems(
  apps: { id: string; package: PackageKind; travelerName: string; visaFeeThb: number; serviceFeeThb: number }[],
  addons: { id: string; applicationId: string; name: string; priceThb: number }[],
): LineItem[] {
  const items: LineItem[] = [];
  for (const a of apps) {
    items.push({ kind: "visa_fee", applicationId: a.id, label: `Thai visa fee · ${a.travelerName}`, amountThb: a.visaFeeThb });
    items.push({ kind: "service_fee", applicationId: a.id, label: `Service fee (${a.package}) · ${a.travelerName}`, amountThb: a.serviceFeeThb });
  }
  for (const x of addons) items.push({ kind: "addon", applicationId: x.applicationId, addonOrderId: x.id, label: x.name, amountThb: x.priceThb });
  return items;
}

/** Whole baht only; Stripe takes satang (1/100). Throws on non-finite or negative values so a bug can never charge a wrong amount. */
export function totalThb(items: LineItem[]): number {
  let sum = 0;
  for (const i of items) {
    if (!Number.isFinite(i.amountThb) || i.amountThb < 0) throw new Error("invalid amount in order");
    sum += Math.round(i.amountThb * 100);
  }
  return sum / 100;
}
export const toSatang = (thb: number) => Math.round(thb * 100);

export const parseFees = (v: unknown, fallback: Fees): Fees => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : d);
  return { visa_thb: n(o.visa_thb, fallback.visa_thb), regular_service_thb: n(o.regular_service_thb, fallback.regular_service_thb), express_service_thb: n(o.express_service_thb, fallback.express_service_thb) };
};
