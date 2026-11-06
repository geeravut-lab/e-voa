import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import { DICTS } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

/** The receipt as a PDF, for its owner only (the payment row is read with the traveler's own session, so RLS decides). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const nf = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const v = await getViewer(); const { id } = await ctx.params;
  if (!v.user || !/^[0-9a-f-]{36}$/i.test(id)) return nf();
  const db = await createClient();
  const { data: p } = await db.from("payments").select("id, receipt_no, amount_thb, items, paid_at").eq("id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!p?.receipt_no) return nf();
  const { data: refunds } = await db.from("refunds").select("amount_thb, reason, created_at").eq("payment_id", p.id).eq("status", "succeeded");
  const { brandName } = await getT();
  const items = (Array.isArray(p.items) ? p.items : []) as { label: string; amountThb: number }[];
  const bytes = await buildReceiptPdf({ brand: brandName, receiptNo: p.receipt_no, paidAt: p.paid_at, lines: items.map((i) => ({ label: i.label, amountThb: Number(i.amountThb) })), totalThb: Number(p.amount_thb),
    refunds: (refunds ?? []).map((r) => ({ label: r.reason ?? "refund", amountThb: Number(r.amount_thb) })), note: DICTS.en.receipt_note });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${p.receipt_no}.pdf"`, "Cache-Control": "private, no-store" } });
}
