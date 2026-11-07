import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { exportMyData } from "@/lib/privacy/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** "Download my data": everything held about the signed-in person, as JSON. Only for the person themselves; every download is recorded. */
export async function GET() {
  const v = await getViewer();
  if (!v.user) return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!(await rateLimit(`export:${v.user.id}`, 5, 86_400))) return new NextResponse("Too many requests", { status: 429, headers: { "Cache-Control": "no-store" } });
  const data = await exportMyData(v.user.id, v.user.email ?? null);
  await audit({ actorId: v.user.id, action: "account.export", entity: "profiles", entityId: v.user.id });
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="thaipass-my-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}
