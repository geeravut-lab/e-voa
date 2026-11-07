import "server-only";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { resolveRange } from "@/lib/revenue/range";
import { canViewTourism, loadReport, SECTION_KEYS } from "./service";
import { reportCsv } from "./stats";

/** The statistics file for the chosen range: for staff and report viewers only (anyone else gets a 404); every export is recorded. */
export async function tourismCsv(req: Request): Promise<NextResponse> {
  const v = await getViewer();
  if (!v.user || !(await canViewTourism(v))) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const u = new URL(req.url).searchParams, { t } = await getT();
  const range = resolveRange(u.get("range") ?? undefined, new Date(), u.get("from") ?? undefined, u.get("to") ?? undefined);
  const report = await loadReport(range, t);
  await audit({ actorId: v.user.id, actorRole: v.isAdmin ? "admin" : "user", action: "report.tourism_export", entity: "tourism", detail: { range: range.key, from: range.fromDate, to: range.toDate } });
  return new NextResponse(reportCsv(report, (s) => (t as unknown as Record<string, string>)[SECTION_KEYS[s]]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tourism-${range.fromDate}_${range.toDate}.csv"`, "Cache-Control": "no-store" } });
}
