import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasServiceRole, envValue } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * What is configured on this server: yes/no per setting, never a value. Open https://<site>/api/health after changing Vercel variables
 * (and redeploying) to see what is still missing. "core" must all be true for sign-in and applications to work.
 */
export async function GET() {
  const set = (name: string) => Boolean(envValue(name));            // "null" / blank counts as not set
  const keyBytes = Buffer.from(envValue("DATA_ENCRYPTION_KEY"), "base64").length, keyOk = keyBytes === 32;
  const core = { NEXT_PUBLIC_SUPABASE_URL: Boolean(SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY: hasServiceRole(), DATA_ENCRYPTION_KEY_valid_32_bytes: keyOk,
    // only the length is shown, never the value: a correct key decodes to exactly 32 bytes (a 44-character base64 text ending in "=")
    DATA_ENCRYPTION_KEY_decoded_bytes: keyBytes, CRON_SECRET: set("CRON_SECRET") };
  const optional = { STRIPE_SECRET_KEY: set("STRIPE_SECRET_KEY"), STRIPE_WEBHOOK_SECRET: set("STRIPE_WEBHOOK_SECRET"), IMMIGRATION_API_URL: set("IMMIGRATION_API_URL"), IMMIGRATION_CALLBACK_SECRET: set("IMMIGRATION_CALLBACK_SECRET"), PARTNER_CALLBACK_SECRET: set("PARTNER_CALLBACK_SECRET"), FLIGHT_API_URL: set("FLIGHT_API_URL"), FLIGHT_API_KEY: set("FLIGHT_API_KEY"), PARTNER_INSURANCE_URL: set("PARTNER_INSURANCE_URL"), PARTNER_SIM_URL: set("PARTNER_SIM_URL"), PARTNER_VIP_URL: set("PARTNER_VIP_URL"), PARTNER_BHS_URL: set("PARTNER_BHS_URL") };
  return NextResponse.json({ ok: core.NEXT_PUBLIC_SUPABASE_URL && core.NEXT_PUBLIC_SUPABASE_ANON_KEY && core.SUPABASE_SERVICE_ROLE_KEY && keyOk && core.CRON_SECRET, core, optional }, { headers: { "Cache-Control": "no-store" } });
}
