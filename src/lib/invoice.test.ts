import { describe, expect, it } from "vitest";
import { computeInvoice, companyReady, parseCompany } from "@/lib/invoice";

const items = [{ kind: "visa_fee", label: "Thai visa fee", amountThb: 2000 }, { kind: "service_fee", label: "Service fee", amountThb: 600 }, { kind: "addon", label: "eSIM", amountThb: 399 }];
describe("invoice maths", () => {
  it("VAT registered: VAT is inside the price of service fee and extras; the visa fee is collected on behalf and stays outside", () => {
    const r = computeInvoice(items, { vat_registered: true, vat_rate: 7, visa_fee_pass_through: true });
    expect(r.lines.map((l) => l.vatThb)).toEqual([0, 39.25, 26.1]);
    expect(r.lines[1].netThb + r.lines[1].vatThb).toBe(600);
    expect(r.totalThb).toBe(2999); expect(r.vatThb).toBe(65.35); expect(r.netThb + r.vatThb).toBe(r.totalThb);
  });
  it("visa fee treated as VAT-able when the setting says so", () => { expect(computeInvoice(items.slice(0, 1), { vat_registered: true, vat_rate: 7, visa_fee_pass_through: false }).lines[0].vatThb).toBe(130.84); });
  it("not VAT registered: no VAT anywhere", () => { const r = computeInvoice(items, { vat_registered: false, vat_rate: 7, visa_fee_pass_through: true }); expect(r.vatThb).toBe(0); expect(r.netThb).toBe(2999); });
  it("company details: only a 13-digit tax id, a 5-digit branch and a sane rate are accepted; the seller must be identified", () => {
    expect(parseCompany({ tax_id: "12345", vat_rate: 99, branch: "1" })).toMatchObject({ tax_id: "", vat_rate: 7, branch: "00000" });
    const ok = parseCompany({ legal_name: "ThaiPass Co., Ltd.", tax_id: "0105500000000", address: "1 Road", vat_registered: "on" });
    expect(ok).toMatchObject({ tax_id: "0105500000000", vat_registered: true }); expect(companyReady(ok)).toBe(true); expect(companyReady(parseCompany({}))).toBe(false);
  });
});
