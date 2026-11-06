import type { PDFDocument as PDFDoc } from "pdf-lib";

// Tax invoice maths and layout. The seller's details and the VAT treatment come from the admin's "company" setting; the accountant must confirm the wording and the treatment
// of each kind of line (the visa fee is shown as money collected on behalf of the government, outside VAT, unless the setting says otherwise).
export type Company = { legal_name: string; legal_name_th: string; tax_id: string; branch: string; address: string; address_th: string; vat_registered: boolean; vat_rate: number; visa_fee_pass_through: boolean };
export const EMPTY_COMPANY: Company = { legal_name: "", legal_name_th: "", tax_id: "", branch: "00000", address: "", address_th: "", vat_registered: false, vat_rate: 7, visa_fee_pass_through: true };

export const parseCompany = (v: unknown): Company => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const rate = Number(o.vat_rate);
  return { legal_name: s(o.legal_name, 120), legal_name_th: s(o.legal_name_th, 120), tax_id: /^\d{13}$/.test(s(o.tax_id, 13)) ? s(o.tax_id, 13) : "", branch: /^\d{5}$/.test(s(o.branch, 5)) ? s(o.branch, 5) : "00000",
    address: s(o.address, 300), address_th: s(o.address_th, 300), vat_registered: o.vat_registered === true || o.vat_registered === "on", vat_rate: Number.isFinite(rate) && rate >= 0 && rate <= 20 ? rate : 7, visa_fee_pass_through: o.visa_fee_pass_through !== false && o.visa_fee_pass_through !== "off" };
};
/** An invoice can only be issued when the seller is identified. */
export const companyReady = (c: Company) => Boolean(c.legal_name && c.tax_id && (c.address || c.address_th));

export type InvLine = { label: string; amountThb: number; vat: "included" | "none"; vatThb: number; netThb: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Prices are what the customer paid (VAT included where VAT applies). The VAT inside a price is price × rate ÷ (100 + rate). */
export function computeInvoice(items: { kind?: string; label: string; amountThb: number }[], c: Pick<Company, "vat_registered" | "vat_rate" | "visa_fee_pass_through">): { lines: InvLine[]; netThb: number; vatThb: number; totalThb: number } {
  const lines = items.map((i): InvLine => {
    const amount = r2(Number(i.amountThb));
    const outside = !c.vat_registered || (i.kind === "visa_fee" && c.visa_fee_pass_through);
    const vat = outside ? 0 : r2((amount * c.vat_rate) / (100 + c.vat_rate));
    return { label: i.label, amountThb: amount, vat: outside ? "none" : "included", vatThb: vat, netThb: r2(amount - vat) };
  });
  const sum = (f: (l: InvLine) => number) => r2(lines.reduce((s, l) => s + f(l), 0));
  return { lines, netThb: sum((l) => l.netThb), vatThb: sum((l) => l.vatThb), totalThb: sum((l) => l.amountThb) };
}

export type InvoiceData = { invoiceNo: string; issuedAt: string; seller: Company; buyer: { name: string; address: string; tax_id: string; branch: string }; lines: InvLine[]; vatRegistered: boolean; vatRate: number; netThb: number; vatThb: number; totalThb: number; receiptNo: string | null };
export type { PDFDoc };
