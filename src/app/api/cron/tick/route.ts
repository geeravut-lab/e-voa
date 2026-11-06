import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Scheduled tick (vercel.json: every 10 minutes). One entry point for timed work.
 * Phase 2+ plugs in: SLA reminders, payment time-outs, document retention clean-up, partner reminders (see docs/evoa/04).
 * Each rule must be idempotent and must never stop the others.
 */
export async function GET(req: NextRequest) {
  const secret = serverEnv().cronSecret;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !same(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ran: [] as string[], at: new Date().toISOString() });
}
