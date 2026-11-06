import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasServiceRole } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * What is configured on this server: yes/no per setting, never a value. Open https://<site>/api/health after changing Vercel variables
 * (and redeploying) to see what is still missing. "core" must all be true for sign-in and applications to work.
 */
export async function GET() {
  const set = (name: string) => Boolean(process.env[name]);
  let keyOk = false; try { keyOk = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "base64").length === 32; } catch { keyOk = false; }
  const core = { NEXT_PUBLIC_SUPABASE_URL: Boolean(SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY: hasServiceRole(), DATA_ENCRYPTION_KEY_valid_32_bytes: keyOk, CRON_SECRET: set("CRON_SECRET") };
  const optional = { STRIPE_SECRET_KEY: set("STRIPE_SECRET_KEY"), STRIPE_WEBHOOK_SECRET: set("STRIPE_WEBHOOK_SECRET"), IMMIGRATION_API_URL: set("IMMIGRATION_API_URL"), IMMIGRATION_CALLBACK_SECRET: set("IMMIGRATION_CALLBACK_SECRET"), PARTNER_CALLBACK_SECRET: set("PARTNER_CALLBACK_SECRET"), FLIGHT_API_URL: set("FLIGHT_API_URL") };
  return NextResponse.json({ ok: Object.values(core).every(Boolean), core, optional }, { headers: { "Cache-Control": "no-store" } });
}
