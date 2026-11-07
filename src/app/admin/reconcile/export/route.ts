import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCsv, thaiDayRange, type Issue } from "@/lib/reconcile/rules";

export const dynamic = "force-dynamic";
/** One day's reconciliation as CSV. Back-office only; every export is recorded. */
export async function GET(req: Request) {
  const v = await getViewer();
  if (!v.user || !v.isAdmin || !v.caps.includes("finance")) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const day = new URL(req.url).searchParams.get("date") ?? "";
  if (!thaiDayRange(day)) return new NextResponse("Bad date", { status: 400 });
  const { data: r } = await createAdminClient().from("reconciliation_reports").select("*").eq("day", day).maybeSingle();
  if (!r) return new NextResponse("Not found", { status: 404 });
  await audit({ actorId: v.user.id, actorRole: "admin", action: "report.reconcile_export", entity: "reconciliation", detail: { day } });
  const csv = reportCsv({ day, stripeGrossThb: r.stripe_gross_thb, oursGrossThb: r.ours_gross_thb, stripeRefundsThb: r.stripe_refunds_thb, oursRefundsThb: r.ours_refunds_thb, stripeCount: r.stripe_count, oursCount: r.ours_count, issues: (r.issues ?? []) as Issue[] });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reconciliation-${day}.csv"`, "Cache-Control": "no-store" } });
}
