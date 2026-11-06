import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { parseLiveKeys } from "@/lib/live/watch";

export const dynamic = "force-dynamic";

/**
 * Fallback fingerprint for when the realtime socket is unavailable. Numbers and ids only, no names or text.
 * Parts are limited to what the signed-in user may see (decided here, not from the query).
 */
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!hasSupabase()) return NextResponse.json({ error: "err_not_configured" }, { status: 401, headers });
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "err_not_signed_in" }, { status: 401, headers });

  const wanted = parseLiveKeys(req.nextUrl.searchParams.get("w"));
  const parts: string[] = [];
  if (wanted.includes("notif")) {
    const { count } = await supabase.from("app_notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    const { data: last } = await supabase.from("app_notifications").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    parts.push(`n${count ?? 0}@${last?.created_at ?? "-"}`);
  }
  if (wanted.includes("admin")) {
    const { data: isAdmin } = await supabase.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (isAdmin) {
      const { count } = await supabase.from("audit_log").select("id", { count: "exact", head: true });
      parts.push(`a${count ?? 0}`);
    }
  }
  return NextResponse.json({ t: parts.join("|") }, { headers });
}
