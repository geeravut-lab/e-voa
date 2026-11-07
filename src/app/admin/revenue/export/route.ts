import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { loadRevenue } from "@/lib/revenue/service";
import { resolveRange } from "@/lib/revenue/range";
import { revenueCsv } from "@/lib/revenue/aggregate";

export const dynamic = "force-dynamic";
/** The revenue file for the chosen range (same query string as the page). Back-office only; every export is recorded. */
export async function GET(req: Request) {
  const v = await getViewer();
  if (!v.user || !v.isAdmin || !v.caps.includes("finance")) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const u = new URL(req.url).searchParams;
  const range = resolveRange(u.get("range") ?? undefined, new Date(), u.get("from") ?? undefined, u.get("to") ?? undefined);
  const { paid, refunds } = await loadRevenue(range);
  await audit({ actorId: v.user.id, actorRole: "admin", action: "report.revenue_export", entity: "revenue", detail: { range: range.key, from: range.fromDate, to: range.toDate, rows: paid.length + refunds.length } });
  return new NextResponse(revenueCsv(paid, refunds), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="revenue-${range.fromDate}_${range.toDate}.csv"`, "Cache-Control": "private, no-store" } });
}
