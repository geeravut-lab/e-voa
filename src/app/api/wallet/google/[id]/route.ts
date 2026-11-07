import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/ratelimit";
import { googleWalletLink } from "@/lib/wallet/service";

export const dynamic = "force-dynamic";

/** "Add to Google Wallet": sends the signed-in owner of an approved application to Google with the signed link. Anything else is a plain 404 (or 401 / 429). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const nope = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return nope(404);
  const v = await getViewer(); if (!v.user) return nope(401);
  if (!(await rateLimit(`wallet:${v.user.id}`, 20, 3600))) return nope(429);
  const { lang } = await getT();
  const r = await googleWalletLink(v.user.id, id, { lang });
  return r.ok ? NextResponse.redirect(r.url, { status: 303, headers: { "Cache-Control": "no-store" } }) : nope(404);
}
