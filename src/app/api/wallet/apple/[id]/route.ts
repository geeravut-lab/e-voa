import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/ratelimit";
import { appleWalletFile } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** "Add to Apple Wallet": the signed .pkpass for the signed-in owner of an approved application. Anything else is a plain 404 (or 401 / 429). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const nope = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return nope(404);
  const v = await getViewer(); if (!v.user) return nope(401);
  if (!(await rateLimit(`wallet:${v.user.id}`, 20, 3600))) return nope(429);
  const r = await appleWalletFile(v.user.id, id, { lang: (await getT()).lang });
  if (!r.ok) return nope(r.error === "failed" ? 500 : 404);
  return new NextResponse(new Uint8Array(r.file), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="${r.filename}"`, "Cache-Control": "no-store" } });
}
