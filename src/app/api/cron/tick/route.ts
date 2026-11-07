import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { runTick } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Scheduled tick: one entry point for timed work (see lib/jobs.ts). vercel.json runs it once a day (the Hobby plan limit);
 * for every-10-minutes, call this URL from Supabase pg_cron or any scheduler with `Authorization: Bearer <CRON_SECRET>`.
 * `?only=warnings` (names separated by commas) runs only those jobs: the GitHub workflow warnings.yml calls it every 30 minutes so official weather warnings reach phones soon.
 */
export async function GET(req: NextRequest) {
  const secret = serverEnv().cronSecret;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !same(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const only = (req.nextUrl.searchParams.get("only") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[a-z_]{2,30}$/.test(x));
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...(await runTick(only.length ? only : undefined)) });
}
