import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { loadStatement, membershipOf } from "@/lib/agency/service";
import { statementCsv } from "@/lib/agency/statement";
import { buildStatementPdf } from "@/lib/agency/statement-pdf";
import { loadCompany } from "@/lib/invoice-service";
import { isPeriod, periodOf } from "@/lib/partner-portal/rules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const no = (code: number) => new NextResponse(code === 401 ? "Sign in" : "Not found", { status: code, headers: { "Cache-Control": "no-store" } });

/** /agency/statement?month=YYYY-MM&format=pdf|csv — a member sees its own agency; staff can name any agency with &agency=<id>. */
export async function GET(req: Request) {
  const v = await getViewer(); if (!v.user) return no(401);
  const u = new URL(req.url).searchParams;
  const month = isPeriod(u.get("month")) ? u.get("month")! : periodOf(new Date());
  let agencyId: string | null = null;
  const m = await membershipOf(v.user.id);
  if (v.isAdmin && u.get("agency") && /^[0-9a-f-]{36}$/i.test(u.get("agency")!)) agencyId = u.get("agency");
  else if (m && m.agency.status === "active") agencyId = m.agency.id;
  if (!agencyId) return no(404);
  const st = await loadStatement(agencyId, month); if (!st) return no(404);
  const base = `statement-${st.statementNo}`;
  if (u.get("format") === "csv") return new NextResponse(statementCsv(st), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "private, no-store" } });
  const { data: paid } = await createAdminClient().from("agency_payouts").select("paid_at").eq("agency_id", agencyId).eq("period", month).maybeSingle();
  const pdf = await buildStatementPdf(st, await loadCompany(), paid?.paid_at ?? null);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"`, "Cache-Control": "private, no-store" } });
}
