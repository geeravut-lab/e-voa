import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, hasServiceRole, serverEnv } from "@/lib/env";
import { HubExchangeSchema, checkSlug, syntheticEmail } from "@/lib/sso";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";
import { loadFlags } from "@/lib/flags";

export const dynamic = "force-dynamic";

const fail = (status: number, code: string) => NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Trades a one-time Aivora ticket for a Supabase session (docs/SSO-Aivora-Supabase.md, steps 2–3).
 * The service-role key never leaves this function. Accounts are matched by aivora_user_id ONLY, never by email.
 */
export async function POST(req: NextRequest) {
  try {
    if (!hasServiceRole()) { console.error("[sso] service role not configured"); return fail(500, "err_not_configured"); }
    if (!(await loadFlags()).login_line) return fail(403, "err_feature_off");

    const body = (await req.json().catch(() => null)) as { ticket?: unknown } | null;
    const ticket = typeof body?.ticket === "string" ? body.ticket : "";
    if (!ticket || ticket.length > 2000) { console.error("[sso] missing ticket"); return fail(401, "err_sso_ticket"); }

    const { hubUrl, appSlug } = serverEnv();

    // 1) Ask the hub who this ticket belongs to.
    let hubRes: Response;
    try {
      hubRes = await fetch(`${hubUrl}/api/public/sso/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch (e) {
      console.error("[sso] hub unreachable:", (e as Error).message);
      return fail(502, "err_sso_hub");              // 502 only when the hub really cannot be reached
    }
    if (hubRes.status >= 500) { console.error("[sso] hub error", hubRes.status); return fail(502, "err_sso_hub"); }
    if (!hubRes.ok) { console.error("[sso] hub rejected ticket", hubRes.status); return fail(401, "err_sso_ticket"); }

    const parsed = HubExchangeSchema.safeParse(await hubRes.json().catch(() => null));
    if (!parsed.success) { console.error("[sso] unexpected hub payload", parsed.error.issues.map((i) => i.path.join(".")).join(",")); return fail(401, "err_sso_ticket"); }
    const hub = parsed.data;
    const slugErr = checkSlug(hub, appSlug);
    if (slugErr) { console.error("[sso] app_slug mismatch"); return fail(slugErr.status, slugErr.code); }

    // 2) Find or create OUR user, keyed by the hub's user id.
    const admin = createAdminClient();
    const aivoraId = hub.user.id;
    const host = new URL(SITE_URL).hostname;
    let userId: string | null = null;

    const link = await admin.from("aivora_links").select("user_id").eq("aivora_user_id", aivoraId).maybeSingle();
    if (link.error) { console.error("[sso] link lookup failed", link.error.code, link.error.message); return fail(500, "err_generic"); }
    userId = link.data?.user_id ?? null;

    if (!userId) {
      const meta = { display_name: hub.user.display_name ?? undefined, avatar_url: hub.user.avatar_url ?? undefined };
      const appMeta = { aivora_user_id: aivoraId, provider: "aivora" };
      // Use the hub's email if present; if a normal account already owns it we must NOT take that account over, so fall back to the placeholder.
      let created = hub.user.email
        ? await admin.auth.admin.createUser({ email: hub.user.email, email_confirm: true, app_metadata: appMeta, user_metadata: meta })
        : null;
      if (!created || created.error) {
        if (created?.error) console.error("[sso] createUser with hub email failed:", created.error.code);
        created = await admin.auth.admin.createUser({ email: syntheticEmail(aivoraId, host), email_confirm: true, app_metadata: appMeta, user_metadata: meta });
      }
      if (created.error || !created.data.user) { console.error("[sso] createUser failed:", created.error?.code, created.error?.message); return fail(500, "err_generic"); }
      userId = created.data.user.id;
      const ins = await admin.from("aivora_links").insert({ aivora_user_id: aivoraId, user_id: userId });
      if (ins.error && ins.error.code !== "23505") { console.error("[sso] link insert failed", ins.error.code, ins.error.message); return fail(500, "err_generic"); }
    } else {
      // Existing person: fill in blanks only, never overwrite what they edited themselves.
      const { data: p } = await admin.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle();
      const patch: Record<string, string> = {};
      if (p && !p.display_name && hub.user.display_name) patch.display_name = hub.user.display_name;
      if (p && !p.avatar_url && hub.user.avatar_url) patch.avatar_url = hub.user.avatar_url;
      if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", userId);
    }

    // 3) Mint a session for that user.
    const { data: u, error: ue } = await admin.auth.admin.getUserById(userId);
    if (ue || !u.user?.email) { console.error("[sso] getUserById failed", ue?.message); return fail(500, "err_generic"); }
    const gl = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    const tokenHash = gl.data?.properties?.hashed_token;
    if (gl.error || !tokenHash) { console.error("[sso] generateLink failed", gl.error?.code, gl.error?.message); return fail(500, "err_generic"); }
    // verifyOtp turns the client it runs on into THAT USER's client. Use a throw-away one so `admin` keeps its service-role rights.
    const v = await createAdminClient().auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (v.error || !v.data.session) { console.error("[sso] verifyOtp failed", v.error?.code, v.error?.message); return fail(500, "err_generic"); }

    await Promise.all([audit({ actorId: userId, action: "auth.login", detail: { provider: "aivora" } }), trackEvent(userId, "login", "aivora")]);
    return NextResponse.json(
      { access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token, profile: { display_name: hub.user.display_name ?? null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[sso] unexpected failure:", (e as Error).message);
    return fail(500, "err_generic");
  }
}
