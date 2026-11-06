#!/usr/bin/env node
// End-to-end check of the Supabase setup: trigger, RLS, session minting (same steps as /api/sso/exchange) and live sync over the real Realtime service.
// It creates ONE temporary user and deletes it at the end. Keys come from the environment and are never printed:
//   SB_URL=https://<ref>.supabase.co SB_ANON=<anon key> SB_SERVICE=<service_role key> node scripts/e2e-supabase.mjs
// Inside the cloud sandbox also set: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
import { createClient } from "@supabase/supabase-js";
const url = process.env.SB_URL, anon = process.env.SB_ANON, service = process.env.SB_SERVICE;
const out = []; const ok = (name, pass, extra = "") => { out.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
let userId;
try {
  const email = `e2e-${Date.now()}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: "E2E Tester", avatar_url: "https://example.com/a.png" }, app_metadata: { aivora_user_id: "e2e", provider: "aivora" } });
  ok("create user (admin API)", !c.error, c.error?.message); userId = c.data?.user?.id;
  const prof = await admin.from("profiles").select("display_name, avatar_url, lang, email").eq("id", userId).maybeSingle();
  ok("profile row created by trigger with display name + avatar", prof.data?.display_name === "E2E Tester" && !!prof.data?.avatar_url, JSON.stringify(prof.data));

  // same session-minting steps as /api/sso/exchange
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }).auth.verifyOtp({ type: "magiclink", token_hash: gl.data?.properties?.hashed_token });
  const session = v.data?.session; ok("mint session (generateLink + verifyOtp)", !!session?.access_token, v.error?.message);

  const me = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${session.access_token}` } } });
  const own = await me.from("profiles").select("id"); ok("RLS: user sees only own profile", own.data?.length === 1);
  const badUpd = await me.from("profiles").update({ email: "x@y.z" }).eq("id", userId).select("id"); ok("RLS: user cannot change profile email", !!badUpd.error || (badUpd.data?.length ?? 0) === 0, badUpd.error?.message);
  const goodUpd = await me.from("profiles").update({ lang: "th" }).eq("id", userId).select("id"); ok("user can change own language", goodUpd.data?.length === 1, goodUpd.error?.message);
  const aud = await me.from("audit_log").select("id"); ok("RLS: non-admin sees no audit rows", (aud.data?.length ?? 0) === 0 && !aud.error);
  const adm = await me.from("admins").insert({ user_id: userId, is_owner: true }); ok("RLS: user cannot make themselves admin (insert)", !!adm.error, adm.error?.message);
  const rpc = await me.rpc("grant_admin", { p_email: email }); ok("grant_admin refused for non-admin", /err_forbidden/.test(rpc.error?.message ?? ""), rpc.error?.message);
  const an = await me.rpc("admin_analytics", { p_days: 7 }); ok("admin_analytics refused for non-admin", /err_forbidden/.test(an.error?.message ?? ""));
  const settings = await me.from("platform_settings").select("key"); ok("RLS: platform_settings hidden from users", (settings.data?.length ?? 0) === 0);
  const ping = await me.rpc("live_ping", { p_topic: "x" }); ok("live_ping not callable by users", !!ping.error, ping.error?.message);

  // live sync over the real Realtime service
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  sb.realtime.setAuth(session.access_token);
  let got = 0; let subscribed = false;
  const ch = sb.channel(`u:${userId}`, { config: { private: true } }).on("broadcast", { event: "ping" }, () => { got++; });
  await new Promise((res) => { const t = setTimeout(res, 12000); ch.subscribe((s) => { if (s === "SUBSCRIBED") { subscribed = true; clearTimeout(t); res(); } }); });
  ok("realtime: private channel subscribed with user token", subscribed);
  if (subscribed) {
    await new Promise((r) => setTimeout(r, 4000)); // Realtime needs a few seconds after joining before database pings flow
    const ins = await admin.from("app_notifications").insert({ user_id: userId, title: "e2e", dedupe_key: "e2e-1" }).select("id");
    ok("notification insert", ins.data?.length === 1, ins.error?.message);
    for (let i = 0; i < 30 && got === 0; i++) await new Promise((r) => setTimeout(r, 300));
    ok("realtime: ping received after insert", got >= 1, `pings=${got}`);
    // another user's topic must be refused
    const sb2 = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }); sb2.realtime.setAuth(session.access_token);
    let other = "none"; const ch2 = sb2.channel("u:00000000-0000-0000-0000-000000000000", { config: { private: true } });
    await new Promise((res) => { const t = setTimeout(res, 8000); ch2.subscribe((s) => { other = s; if (s !== "SUBSCRIBED" && s !== "JOINING") { clearTimeout(t); res(); } if (s === "SUBSCRIBED") { clearTimeout(t); res(); } }); });
    ok("realtime: cannot listen to someone else's topic", other !== "SUBSCRIBED", `status=${other}`);
    const mk = await me.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("dedupe_key", "e2e-1").select("id"); ok("user can mark own notification read", mk.data?.length === 1, mk.error?.message);
    const mt = await me.from("app_notifications").update({ title: "hacked" }).eq("dedupe_key", "e2e-1").select("id"); ok("user cannot edit notification text", !!mt.error || (mt.data?.length ?? 0) === 0, mt.error?.message);
    await sb.removeChannel(ch); await sb2.removeChannel(ch2);
  }
} catch (e) { ok("script error", false, String(e.message ?? e)); }
finally {
  if (userId) { const d = await admin.auth.admin.deleteUser(userId); const left = await admin.from("profiles").select("id").eq("id", userId); out.push(`CLEANUP  test user deleted=${!d.error}, profile rows left=${left.data?.length ?? "?"}`); }
}
console.log(out.join("\n")); process.exit(0);
