import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Hands the realtime socket an access token. The socket client never touches the login cookies, so it cannot race the server on refresh. */
export async function GET() {
  const none = { status: 401, headers: { "Cache-Control": "no-store" } };
  if (!hasSupabase()) return NextResponse.json({ error: "err_not_configured" }, none);
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "err_not_signed_in" }, none);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return NextResponse.json({ error: "err_not_signed_in" }, none);
  return NextResponse.json({ token: data.session.access_token }, { headers: { "Cache-Control": "no-store" } });
}
