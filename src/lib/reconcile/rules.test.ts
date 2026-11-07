import { describe, expect, it } from "vitest";
import { reconcile, reportCsv, thaiDayRange, yesterdayThai, type ReconcileInput } from "@/lib/reconcile/rules";

const day = thaiDayRange("2026-12-02")!, at = (h: number) => Math.floor((day.from.getTime() + h * 3_600_000) / 1000);
const base = (o: Partial<ReconcileInput> = {}): ReconcileInput => ({ day: "2026-12-02", from: day.from, to: day.to, charges: [], refunds: [], ours: [], ourRefunds: [], stripeHasPi: new Set(), stripeHasRefund: new Set(), ...o });
const pay = (pi: string, amountThb: number, h = 10, status = "paid") => ({ id: `p-${pi}`, pi, amountThb, status, paidAt: new Date((at(h) + 60) * 1000).toISOString(), receipt: `R-${pi}` });
const charge = (pi: string, amountThb: number, h = 10) => ({ id: `ch_${pi}`, pi, amountThb, created: at(h), paid: true });

describe("Thai day", () => {
  it("is 17:00 UTC to 17:00 UTC, and bad dates are refused", () => {
    expect(day.from.toISOString()).toBe("2026-12-01T17:00:00.000Z"); expect(day.to.toISOString()).toBe("2026-12-02T17:00:00.000Z");
    expect(thaiDayRange("2026-02-30")).toBeNull(); expect(thaiDayRange("nope")).toBeNull(); expect(yesterdayThai(new Date("2026-12-03T05:00:00Z"))).toBe("2026-12-02");
  });
});
describe("reconciliation", () => {
  it("is clean when both sides agree (a few minutes apart is fine)", () => {
    const r = reconcile(base({ charges: [charge("pi_1", 2600), charge("pi_2", 3100)], ours: [pay("pi_1", 2600), pay("pi_2", 3100)] }));
    expect(r.issues).toEqual([]); expect(r).toMatchObject({ stripeGrossThb: 5700, oursGrossThb: 5700, stripeCount: 2, oursCount: 2 });
  });
  it("finds money Stripe took that we do not have as paid, and the other way round", () => {
    const r = reconcile(base({ charges: [charge("pi_1", 2600), charge("pi_9", 700)], ours: [pay("pi_1", 2600), pay("pi_5", 900), { ...pay("pi_9", 700), status: "pending" }] }));
    expect(r.issues.map((x) => [x.kind, x.ref])).toEqual([["stripe_only", "pi_9"], ["ours_only", "R-pi_5"]]);
  });
  it("does not call it ours-only when Stripe confirms the payment exists (it was just outside the day)", () => {
    expect(reconcile(base({ ours: [pay("pi_7", 500)], stripeHasPi: new Set(["pi_7"]) })).issues).toEqual([]);
  });
  it("finds amount differences", () => { expect(reconcile(base({ charges: [charge("pi_1", 2600)], ours: [pay("pi_1", 2500)] })).issues).toEqual([{ kind: "amount_mismatch", ref: "R-pi_1", stripeThb: 2600, oursThb: 2500 }]); });
  it("a payment on the other side of midnight is not counted in this day, nor reported", () => {
    const r = reconcile(base({ charges: [charge("pi_late", 800, 30)], ours: [pay("pi_late", 800, 30)] })); expect(r.issues).toEqual([]); expect(r.stripeCount).toBe(0);
  });
  it("compares refunds by their id", () => {
    const sr = (id: string, amountThb: number, status = "succeeded") => ({ id, pi: "pi_1", amountThb, created: at(11), status }), or = (id: string, amountThb: number) => ({ id: `o-${id}`, providerRefundId: id, amountThb, status: "succeeded", createdAt: new Date((at(11) + 30) * 1000).toISOString() });
    expect(reconcile(base({ refunds: [sr("re_1", 500)], ourRefunds: [or("re_1", 500)] })).issues).toEqual([]);
    expect(reconcile(base({ refunds: [sr("re_2", 500)] })).issues).toEqual([{ kind: "refund_stripe_only", ref: "re_2", stripeThb: 500, oursThb: null }]);          // refunded in Stripe's dashboard by hand
    expect(reconcile(base({ ourRefunds: [or("re_3", 400)] })).issues).toEqual([{ kind: "refund_ours_only", ref: "re_3", stripeThb: null, oursThb: 400 }]);
    expect(reconcile(base({ refunds: [sr("re_4", 500)], ourRefunds: [or("re_4", 450)] })).issues[0]).toMatchObject({ kind: "refund_mismatch", stripeThb: 500, oursThb: 450 });
    expect(reconcile(base({ refunds: [sr("re_5", 500, "failed")] })).issues).toEqual([]);                                                                              // a failed refund is not money moved
  });
  it("exports the report as CSV", () => {
    const csv = reportCsv(reconcile(base({ charges: [charge("pi_9", 700)] })));
    expect(csv.split("\r\n")[0]).toBe("day,kind,reference,stripe_thb,ours_thb"); expect(csv).toContain("2026-12-02,stripe_only,\"pi_9\",700,");
  });
});
