import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceData } from "@/lib/invoice-service";

export const dynamic = "force-dynamic";

/** The issued tax invoice as a PDF, for its owner (RLS decides: the row is read with the traveler's own session). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const nf = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const v = await getViewer(); const { id } = await ctx.params;
  if (!v.user || !/^[0-9a-f-]{36}$/i.test(id)) return nf();
  const db = await createClient();
  const { data: inv } = await db.from("tax_invoices").select("*").eq("payment_id", id).eq("owner_id", v.user.id).maybeSingle();
  if (!inv) return nf();
  const { data: pay } = await db.from("payments").select("receipt_no").eq("id", id).maybeSingle();
  const bytes = await buildInvoicePdf(invoiceData(inv, pay?.receipt_no ?? null));
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${inv.invoice_no}.pdf"`, "Cache-Control": "private, no-store" } });
}
