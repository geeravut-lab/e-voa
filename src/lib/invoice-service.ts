import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { EMPTY_COMPANY, companyReady, computeInvoice, parseCompany, type InvoiceData } from "@/lib/invoice";

export const loadCompany = async () => parseCompany(await getSetting<unknown>("company", EMPTY_COMPANY));

const Buyer = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().max(300).default(""), tax_id: z.string().trim().max(20).regex(/^[0-9A-Za-z-]*$/).default(""), branch: z.string().trim().max(10).default("") });

/** Issues the tax invoice for a PAID payment, once. The seller's details, the lines and the VAT are frozen into the row, so later setting changes never alter an issued invoice. */
export async function issueInvoice(ownerId: string, paymentId: string, input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const buyer = Buyer.safeParse(input); if (!buyer.success) return { ok: false, error: "err_form_incomplete" };
  const company = await loadCompany(); if (!companyReady(company)) return { ok: false, error: "err_invoice_unavailable" };
  const db = createAdminClient();
  const { data: pay } = await db.from("payments").select("id, status, items, receipt_no, kind").eq("id", paymentId).eq("owner_id", ownerId).maybeSingle();
  if (!pay) return { ok: false, error: "err_not_found" };
  if (!["paid", "partially_refunded", "refunded"].includes(pay.status)) return { ok: false, error: "err_invoice_unavailable" };
  const { data: have } = await db.from("tax_invoices").select("id").eq("payment_id", paymentId).maybeSingle();
  if (have) return { ok: true, id: have.id };
  const items = (Array.isArray(pay.items) ? pay.items : []) as { kind?: string; label: string; amountThb: number }[];
  const inv = computeInvoice(items, company);
  const no = await db.rpc("next_invoice_no"); if (no.error || !no.data) return { ok: false, error: "err_generic" };
  const ins = await db.from("tax_invoices").insert({ invoice_no: no.data, payment_id: paymentId, owner_id: ownerId, buyer: buyer.data, seller: company, lines: inv.lines, vat_registered: company.vat_registered, vat_rate: company.vat_rate, net_thb: inv.netThb, vat_thb: inv.vatThb, total_thb: inv.totalThb }).select("id").single();
  if (ins.error || !ins.data) { if (ins.error?.code === "23505") { const again = await db.from("tax_invoices").select("id").eq("payment_id", paymentId).maybeSingle(); if (again.data) return { ok: true, id: again.data.id }; } return { ok: false, error: "err_generic" }; }
  await audit({ actorId: ownerId, action: "invoice.issue", entity: "payment", entityId: paymentId });
  return { ok: true, id: ins.data.id };
}

export function invoiceData(row: Record<string, unknown>, receiptNo: string | null): InvoiceData {
  return { invoiceNo: String(row.invoice_no), issuedAt: String(row.issued_at), seller: parseCompany(row.seller), buyer: row.buyer as InvoiceData["buyer"], lines: row.lines as InvoiceData["lines"], vatRegistered: Boolean(row.vat_registered), vatRate: Number(row.vat_rate), netThb: Number(row.net_thb), vatThb: Number(row.vat_thb), totalThb: Number(row.total_thb), receiptNo };
}
