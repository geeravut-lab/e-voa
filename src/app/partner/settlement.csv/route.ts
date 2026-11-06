import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { isPeriod, periodOf, settlementCsv } from "@/lib/partner-portal/rules";
import { membershipOf, settlementLines } from "@/lib/partner-portal/service";

export const dynamic = "force-dynamic";
/** The partner's own redeemed orders of one month (?month=YYYY-MM): for its accounting. Members of that partner only. */
export async function GET(req: Request) {
  const u = (await getViewer()).user; if (!u) return new NextResponse("Sign in", { status: 401 });
  const m = await membershipOf(u.id); if (!m) return new NextResponse("Forbidden", { status: 403 });
  const q = new URL(req.url).searchParams.get("month"); const month = isPeriod(q) ? q : periodOf(new Date());
  const lines = await settlementLines(m.partner.id, month, m.partner.settlement_pct, false);
  return new NextResponse(settlementCsv(lines), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settlement-${month}.csv"`, "Cache-Control": "private, no-store" } });
}
