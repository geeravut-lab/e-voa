import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { passToken } from "@/lib/passes";
import { SITE_URL } from "@/lib/env";
import { passCardSvg } from "@/lib/pass-card";

export const dynamic = "force-dynamic";

/** The pass as one self-contained picture (SVG): the traveler saves it to the phone and shows it with no network at the airport. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const nf = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const v = await getViewer(); const { id } = await ctx.params;
  if (!v.user || !/^[0-9a-f-]{36}$/i.test(id)) return nf();
  const db = await createClient();
  const { data: a } = await db.from("applications").select("id, ref_no, trip_id, traveler_id, immigration_ref").eq("id", id).eq("owner_id", v.user.id).in("status", ["approved", "used"]).maybeSingle();
  if (!a) return nf();
  const [{ data: trip }, { data: tr }] = await Promise.all([db.from("trips").select("arrival_date, arrival_flight_no").eq("id", a.trip_id).maybeSingle(), db.from("travelers").select("given_name, surname").eq("id", a.traveler_id).maybeSingle()]);
  const qr = await QRCode.toString(`${SITE_URL}/v/${passToken(a.id)}`, { type: "svg", margin: 0, width: 260, errorCorrectionLevel: "M" });
  const svg = passCardSvg({ name: tr ? `${tr.given_name} ${tr.surname}` : a.ref_no, ref: a.ref_no, arrival: trip?.arrival_date ?? "", flight: trip?.arrival_flight_no ?? "", govRef: a.immigration_ref ?? "", qrSvg: qr });
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="e-voa-${a.ref_no}.svg"`, "Cache-Control": "private, no-store" } });
}
