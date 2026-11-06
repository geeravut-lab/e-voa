import { describe, expect, it } from "vitest";
import { bucketKey, bucketKeys, resolveRange, thaiDate } from "./range";
import { categoryOfAddon, revenueCsv, summarize, type PaidLine, type RefundLine } from "./aggregate";

// 2026-11-06 is a Friday. 10:00 UTC = 17:00 in Thailand.
const NOW = new Date("2026-11-06T10:00:00Z");

describe("revenue ranges (Thai time)", () => {
  it("today, this week (Monday start), this month, this year", () => {
    const t = resolveRange("today", NOW); expect(t.from.toISOString()).toBe("2026-11-05T17:00:00.000Z"); expect(t.to.toISOString()).toBe("2026-11-06T17:00:00.000Z"); expect(t.bucket).toBe("hour");
    const w = resolveRange("week", NOW); expect(w.fromDate).toBe("2026-11-02"); expect(w.toDate).toBe("2026-11-08"); expect(w.bucket).toBe("day");
    const m = resolveRange("month", NOW); expect(m.fromDate).toBe("2026-11-01"); expect(m.toDate).toBe("2026-11-30");
    const y = resolveRange("year", NOW); expect(y.fromDate).toBe("2026-01-01"); expect(y.toDate).toBe("2026-12-31"); expect(y.bucket).toBe("month");
  });
  it("just after midnight in Thailand is already the next day", () => {
    expect(thaiDate(new Date("2026-11-06T17:30:00Z"))).toBe("2026-11-07");
    expect(resolveRange("today", new Date("2026-11-06T17:30:00Z")).fromDate).toBe("2026-11-07");
  });
  it("a custom range includes both end days; bad input falls back to this month", () => {
    const c = resolveRange("custom", NOW, "2026-10-30", "2026-11-02"); expect(c.key).toBe("custom"); expect(c.fromDate).toBe("2026-10-30"); expect(c.toDate).toBe("2026-11-02");
    expect(c.to.toISOString()).toBe("2026-11-02T17:00:00.000Z");
    for (const bad of [["2026-11-05", "2026-11-01"], ["x", "y"], ["2026-02-31", "2026-03-01"], ["2020-01-01", "2026-11-01"]]) expect(resolveRange("custom", NOW, bad[0], bad[1]).key).toBe("month");
    expect(resolveRange("nonsense", NOW).key).toBe("month");
  });
  it("chart columns: 24 hours, every day of the range, every month", () => {
    expect(bucketKeys(resolveRange("today", NOW))).toHaveLength(24);
    expect(bucketKeys(resolveRange("month", NOW))).toHaveLength(30);
    expect(bucketKeys(resolveRange("year", NOW))).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
    expect(bucketKey(new Date("2026-11-06T17:30:00Z"), "day")).toBe("2026-11-07");
  });
});

const line = (o: Partial<PaidLine>): PaidLine => ({ paymentId: "p1", at: "2026-11-06T03:00:00Z", receiptNo: "RC-26-000001", reference: "EV-26-000001", category: "evoa", label: "Thai visa fee", amountThb: 2000, ...o });
const ref = (o: Partial<RefundLine>): RefundLine => ({ refundId: "r1", at: "2026-11-06T05:00:00Z", receiptNo: "RC-26-000001", reference: "EV-26-000001", category: "sim", reason: "unused", amountThb: 100, ...o });

describe("revenue totals", () => {
  const range = resolveRange("week", NOW);
  const paid = [line({}), line({ category: "evoa", label: "Service fee", amountThb: 600 }), line({ category: "sim", label: "eSIM", amountThb: 300 }), line({ paymentId: "p2", category: "insurance", at: "2026-11-03T03:00:00Z", amountThb: 290 }), line({ paymentId: "p3", category: "vip", amountThb: 1500.5 }), line({ paymentId: "p4", category: "health", amountThb: 800 })];
  const s = summarize(paid, [ref({})], range);
  it("adds gross, refunds and net per category and in total", () => {
    expect(s.byCategory.evoa).toEqual({ gross: 2600, refunds: 0, net: 2600 }); expect(s.byCategory.sim).toEqual({ gross: 300, refunds: 100, net: 200 });
    expect(s.gross).toBe(5490.5); expect(s.refunds).toBe(100); expect(s.net).toBe(5390.5); expect(s.payments).toBe(4);
  });
  it("puts each amount in the column of its own day and subtracts refunds on the day they were made", () => {
    const fri = s.series.find((x) => x.key === "2026-11-06")!, tue = s.series.find((x) => x.key === "2026-11-03")!;
    expect(tue.net.insurance).toBe(290); expect(fri.net.sim).toBe(200); expect(fri.gross.sim).toBe(300);
    expect(s.series.reduce((n, x) => n + x.total, 0)).toBeCloseTo(s.net, 2);
  });
  it("add-on categories map to the five revenue groups", () => { expect(["insurance", "sim", "esim", "vip", "health", "x"].map(categoryOfAddon)).toEqual(["insurance", "sim", "sim", "vip", "health", "evoa"]); });
  it("the CSV has a row per line, refunds as negatives, the total, and blocks formulas", () => {
    const csv = revenueCsv([line({ label: "=cmd|x" }), line({ at: "2026-11-05T03:00:00Z", amountThb: 50 })], [ref({})]).replace("﻿", "").trim().split("\n");
    expect(csv[0]).toBe("type,date_time_bangkok,receipt_no,reference,category,description,amount_thb");
    expect(csv[1]).toContain("2026-11-05 10:00:00"); expect(csv.some((r) => r.includes("'=cmd|x"))).toBe(true);
    expect(csv.find((r) => r.startsWith("refund"))).toContain("-100.00"); expect(csv.at(-1)).toContain("2050.00".replace("2050.00", "1950.00"));
  });
});
