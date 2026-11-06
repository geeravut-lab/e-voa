import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";

/** OAuth return (Google): exchange the code for a session cookie, then go where the user was heading. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  if (!hasSupabase() || !code) return NextResponse.redirect(`${origin}/login?error=login_failed`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] code exchange failed", error?.code, error?.message);
    return NextResponse.redirect(`${origin}/login?error=login_failed`);
  }
  await Promise.all([audit({ actorId: data.user.id, action: "auth.login", detail: { provider: "google" } }), trackEvent(data.user.id, "login", "google")]);
  return NextResponse.redirect(`${origin}${next}`);
}
