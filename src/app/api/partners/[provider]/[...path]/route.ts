import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { hasServiceRole, envValue } from "@/lib/env";
import { handlePartnerCallback } from "@/lib/partners/service";
import type { Provider } from "@/lib/partners/client";

export const dynamic = "force-dynamic";
const PROVIDERS = ["insurance", "sim", "vip", "bhs"];
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Partner → ThaiPass callbacks: insurance Confirm_COI, SIM sim_confirm, VIP vip_confirm, health confirm_voucher / callback_result.
 * Address: /api/partners/<provider>/<original path>. Secret: Authorization: Bearer <PARTNER_CALLBACK_SECRET>.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string; path: string[] }> }) {
  const { provider, path } = await ctx.params;
  const secret = envValue("PARTNER_CALLBACK_SECRET");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !same(given, secret)) return NextResponse.json({ status: 401, message: "Not authorized" }, { status: 401 });
  if (!PROVIDERS.includes(provider) || !hasServiceRole()) return NextResponse.json({ status: 404, message: "Incorrect Request" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ status: 400, message: "Incorrect data format" }, { status: 400 });
  try {
    const r = await handlePartnerCallback(provider as Provider, "/" + path.join("/"), body);
    return NextResponse.json(provider === "insurance" ? { status: r.ok ? "success" : "error", message: r.message } : { status: r.ok ? 0 : 1, message: r.message });
  } catch (e) {
    console.error("[partners] callback failed", provider, (e as Error).message);
    return NextResponse.json({ status: 500, message: "Internal Server Error" }, { status: 500 });
  }
}
