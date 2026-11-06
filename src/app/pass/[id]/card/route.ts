import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { passToken } from "@/lib/passes";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
  const inner = qr.replace(/^<\?xml[^>]*>/, "").replace(/<svg /, '<svg x="70" y="150" width="260" height="260" ');
  const name = tr ? `${tr.given_name} ${tr.surname}` : a.ref_no;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560" font-family="system-ui, sans-serif"><rect width="400" height="560" rx="24" fill="white" stroke="rgb(21,87,224)" stroke-width="4"/>
<text x="200" y="50" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="3" fill="rgb(21,87,224)">E-VOA PASS</text>
<text x="200" y="100" text-anchor="middle" font-size="22" font-weight="800" fill="rgb(17,17,17)">${esc(name).slice(0, 40)}</text>
<rect x="60" y="140" width="280" height="280" rx="12" fill="white" stroke="rgb(221,227,238)"/>${inner}
<text x="200" y="460" text-anchor="middle" font-size="18" font-family="monospace" font-weight="700" fill="rgb(17,17,17)">${esc(a.ref_no)}</text>
<text x="200" y="490" text-anchor="middle" font-size="14" fill="rgb(68,68,68)">${esc(trip?.arrival_date ?? "")} ${esc(trip?.arrival_flight_no ?? "")}</text>
<text x="200" y="520" text-anchor="middle" font-size="12" font-family="monospace" fill="rgb(68,68,68)">${esc(a.immigration_ref ?? "")}</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="e-voa-${a.ref_no}.svg"`, "Cache-Control": "private, no-store" } });
}
