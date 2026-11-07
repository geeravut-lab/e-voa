import { describe, expect, it } from "vitest";
import { applyDiscount, codeProblem, discountAmount, normalizeCode, type CodeRow } from "@/lib/discounts/rules";
import { totalThb, type LineItem } from "@/lib/pricing";

const item = (kind: LineItem["kind"], amountThb: number, id = "a1"): LineItem => ({ kind, applicationId: id, label: `${kind} ${amountThb}`, amountThb });
describe("how much a code takes off", () => {
  it("percent of the service fees, rounded down; fixed per payment; never more than the service fees", () => {
    expect(discountAmount({ kind: "percent", value: 10 }, 1200)).toBe(120); expect(discountAmount({ kind: "percent", value: 15 }, 601)).toBe(90);
    expect(discountAmount({ kind: "fixed", value: 300 }, 1200)).toBe(300); expect(discountAmount({ kind: "fixed", value: 5000 }, 1200)).toBe(1200); expect(discountAmount({ kind: "percent", value: 100 }, 1200)).toBe(1200);
  });
  it("gives nothing when there is nothing to discount or the rule is odd", () => { expect(discountAmount({ kind: "percent", value: 10 }, 0)).toBe(0); expect(discountAmount({ kind: "fixed", value: -5 }, 100)).toBe(0); expect(discountAmount({ kind: "percent", value: Number.NaN }, 100)).toBe(0); });
});
describe("applying it to the lines", () => {
  const lines = [item("visa_fee", 2000, "a1"), item("service_fee", 600, "a1"), item("addon", 500, "a1"), item("visa_fee", 2000, "a2"), item("service_fee", 2500, "a2")];
  it("lowers only the service-fee lines, the total drops by exactly the discount, and no line goes below zero", () => {
    const out = applyDiscount(lines, "SAVE", 310);
    expect(totalThb(lines) - totalThb(out)).toBe(310); expect(out.filter((i) => i.kind !== "service_fee").map((i) => i.amountThb)).toEqual([2000, 500, 2000]);
    expect(out.every((i) => i.amountThb >= 0)).toBe(true); expect(out[1].label).toContain("SAVE"); expect(out[0].label).not.toContain("SAVE");
  });
  it("shares in proportion and puts the odd baht on a line that can take it", () => {
    const out = applyDiscount([item("service_fee", 1, "x"), item("service_fee", 2, "y")], "C", 3); expect(out.map((i) => i.amountThb)).toEqual([0, 0]);
    const odd = applyDiscount([item("service_fee", 100, "x"), item("service_fee", 100, "y"), item("service_fee", 100, "z")], "C", 100); expect(totalThb(odd)).toBe(200);
  });
  it("cannot take more than the service fees, and a zero discount changes nothing", () => {
    expect(totalThb(applyDiscount(lines, "BIG", 99999))).toBe(2000 + 500 + 2000); expect(applyDiscount(lines, "NONE", 0)).toBe(lines);
  });
});
describe("is a code usable", () => {
  const base: CodeRow = { id: "1", code: "SAVE", kind: "fixed", value: 100, active: true, valid_from: null, valid_to: null, max_uses: null, per_user: 1 }, now = new Date("2026-12-01T00:00:00Z");
  it("accepts a good code", () => { expect(codeProblem(base, now, 0, 0)).toBeNull(); expect(codeProblem({ ...base, max_uses: 5 }, now, 4, 0)).toBeNull(); });
  it("refuses unknown, switched off, outside its dates, used up, and already used by this person", () => {
    expect(codeProblem(null, now, 0, 0)).toBe("err_discount_invalid"); expect(codeProblem({ ...base, active: false }, now, 0, 0)).toBe("err_discount_invalid");
    expect(codeProblem({ ...base, valid_from: "2026-12-02T00:00:00Z" }, now, 0, 0)).toBe("err_discount_expired"); expect(codeProblem({ ...base, valid_to: "2026-11-30T00:00:00Z" }, now, 0, 0)).toBe("err_discount_expired");
    expect(codeProblem({ ...base, max_uses: 5 }, now, 5, 0)).toBe("err_discount_used_up"); expect(codeProblem(base, now, 1, 1)).toBe("err_discount_per_user"); expect(codeProblem({ ...base, per_user: 2 }, now, 1, 1)).toBeNull();
  });
  it("normalises what people type", () => { expect(normalizeCode(" sa ve-10 ")).toBe("SAVE-10"); });
});
