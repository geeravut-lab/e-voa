import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { hasServiceRole, envValue } from "@/lib/env";
import { StatusCallback } from "@/lib/immigration/schema";
import { resolveGateway } from "@/lib/immigration/resolve";
import { handleStatusCallback } from "@/lib/immigration/pipeline";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Immigration → ThaiPass: "updateStatusById" (ICD v1.2.5 item 6). Approved / Rejected / NeedUpdate for one application.
 * Protected by a shared secret (Authorization: Bearer <IMMIGRATION_CALLBACK_SECRET>). Answers {isSuccess, errorDesc} like the ICD.
 * Safe to receive twice: the same decision is applied once.
 */
export async function POST(req: NextRequest) {
  const secret = envValue("IMMIGRATION_CALLBACK_SECRET");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !same(given, secret)) return NextResponse.json({ isSuccess: false, errorDesc: "Not authorized" }, { status: 401 });
  if (!hasServiceRole()) return NextResponse.json({ isSuccess: false, errorDesc: "Internal Server Error" }, { status: 500 });

  const parsed = StatusCallback.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ isSuccess: false, errorDesc: "Incorrect data format" }, { status: 400 });
  try {
    const result = await handleStatusCallback(parsed.data, await resolveGateway());
    if (!result.isSuccess) await audit({ actorId: null, actorRole: "immigration", action: "immigration.callback.rejected", entity: "application", detail: { reason: (result.errorDesc ?? "").slice(0, 70) } });
    return NextResponse.json({ isSuccess: result.isSuccess, errorDesc: result.errorDesc }, { status: result.retryLater ? 503 : 200 });   // 503: please send it again
  } catch (e) {
    console.error("[immigration] callback failed:", (e as Error).message);
    return NextResponse.json({ isSuccess: false, errorDesc: "Internal Server Error" }, { status: 500 });   // Immigration may retry
  }
}
