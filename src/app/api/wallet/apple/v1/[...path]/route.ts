import { NextResponse, type NextRequest } from "next/server";
import { appleChangedSerials, appleRegister, applePassForPhone, appleUnregister } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Apple's PassKit web service. Phones call it by themselves (there is no signed-in user): every call about one pass carries that pass's own token.
//   POST   /v1/devices/{device}/registrations/{passTypeId}/{serial}   register for updates   (body {pushToken})
//   DELETE /v1/devices/{device}/registrations/{passTypeId}/{serial}   stop updates
//   GET    /v1/devices/{device}/registrations/{passTypeId}?passesUpdatedSince=tag   which passes changed
//   GET    /v1/passes/{passTypeId}/{serial}                           the newest file
//   POST   /v1/log                                                    phones report problems
const empty = (status: number, headers: Record<string, string> = {}) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store", ...headers } });
type Ctx = { params: Promise<{ path: string[] }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  if (p[0] === "log" && p.length === 1) { const body = (await req.json().catch(() => null)) as { logs?: unknown } | null; if (Array.isArray(body?.logs)) console.error("[wallet] phone log", JSON.stringify(body!.logs).slice(0, 500)); return empty(200); }
  if (p[0] === "devices" && p[2] === "registrations" && p.length === 5) {
    const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
    return empty(await appleRegister(p[1], p[3], p[4], req.headers.get("authorization"), body?.pushToken));
  }
  return empty(404);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  return p[0] === "devices" && p[2] === "registrations" && p.length === 5 ? empty(await appleUnregister(p[1], p[3], p[4], req.headers.get("authorization"))) : empty(404);
}
export async function GET(req: NextRequest, { params }: Ctx) {
  const p = (await params).path;
  if (p[0] === "devices" && p[2] === "registrations" && p.length === 4) {
    const r = await appleChangedSerials(p[1], p[3], req.nextUrl.searchParams.get("passesUpdatedSince"));
    return r ? NextResponse.json(r, { headers: { "Cache-Control": "no-store" } }) : empty(204);
  }
  if (p[0] === "passes" && p.length === 3) {
    const r = await applePassForPhone(p[1], p[2], req.headers.get("authorization"), req.headers.get("if-modified-since"));
    if (r.status !== 200) return empty(r.status);
    return new NextResponse(new Uint8Array(r.file), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": r.lastModified, "Cache-Control": "no-store" } });
  }
  return empty(404);
}
