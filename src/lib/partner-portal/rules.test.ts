import { describe, expect, it } from "vitest";
import { categoryAllowed, newVoucherCode, normalizeVoucher, partnerShare, periodRange, settlementCsv, isPeriod } from "./rules";

describe("partner portal rules", () => {
  it("each kind may list only its own categories", () => {
    expect(categoryAllowed("sim", "esim")).toBe(true);
    expect(categoryAllowed("sim", "vip")).toBe(false);
    expect(categoryAllowed("bhs", "health")).toBe(true);
    expect(categoryAllowed("vip", "insurance")).toBe(false);
  });
  it("voucher codes look right and round-trip through hand typing", () => {
    const c = newVoucherCode();
    expect(c).toMatch(/^TP-[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeVoucher(c.toLowerCase())).toBe(c);
    expect(normalizeVoucher(` ${c.replace("-", " ")} `)).toBe(c);
    expect(normalizeVoucher("TP-123")).toBeNull();
    expect(normalizeVoucher("hello world")).toBeNull();
    expect(new Set(Array.from({ length: 200 }, newVoucherCode)).size).toBe(200);
  });
  it("the partner share rounds down, never up", () => {
    expect(partnerShare(1000, 80)).toBe(800);
    expect(partnerShare(333, 80)).toBe(266.4);
    expect(partnerShare(999, 33.33)).toBe(332.96);
    expect(partnerShare(500, 0)).toBe(0);
  });
  it("periods", () => {
    expect(isPeriod("2026-11")).toBe(true); expect(isPeriod("2026-13")).toBe(false); expect(isPeriod("11-2026")).toBe(false);
    expect(periodRange("2026-12")).toEqual({ from: new Date("2026-12-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") });
  });
  it("the settlement CSV totals, quotes commas and blocks formulas", () => {
    const csv = settlementCsv([{ usedAt: "2026-11-02", reference: "A1", code: "TP-AAAA2222", item: '=SUM(A1), "x"', priceThb: 500, shareThb: 400 }, { usedAt: "2026-11-03", reference: "A2", code: "TP-BBBB3333", item: "SIM", priceThb: 250, shareThb: 200 }]);
    const rows = csv.trim().split("\n");
    expect(rows[0]).toBe("used_at,reference,voucher_code,item,price_thb,partner_share_thb");
    expect(rows[1]).toContain(`"'=SUM(A1), ""x"""`);
    expect(rows[3]).toBe("TOTAL,,,2,750.00,600.00");
  });
});
