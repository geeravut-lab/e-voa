// Accessibility (axe-core, WCAG 2.0/2.1 A + AA) of the pages that need a sign-in: traveler pages and the back office, at phone and desktop size.
// Starts `next start` itself (run `npm run build` first). Uses throw-away users (traveler, owner admin) that are deleted at the end.
// Fails on "serious" or "critical" findings; lesser ones are only printed.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { admin, cleanupUsers, makeDraft, makeUser as helperUser, noAuth, ref, sql, SB_ANON, SB_SERVICE, SB_URL, users } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const req = createRequire(import.meta.url);
const { chromium } = req("playwright");
const axeSource = readFileSync(req.resolve("axe-core/axe.min.js"), "utf8");
const PORT = 3191, APP = `http://localhost:${PORT}`;
let server: ChildProcess, browser: Any; let ids = { tripId: "", appId: "" };

function cookiesFor(session: unknown) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`, size = 3180; const base = { domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };
  if (value.length <= size) return [{ ...base, name, value }];
  return value.match(new RegExp(`.{1,${size}}`, "g"))!.map((v, i) => ({ ...base, name: `${name}.${i}`, value: v }));
}
async function session(label: string, owner: boolean) {
  const email = `p2b-a11y-${label}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: `A11y ${label}` } });
  const id = c.data.user!.id; users.push(id);
  if (owner) await sql(`insert into public.admins (user_id, is_owner) values ('${id}', true)`);
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(SB_URL, SB_SERVICE, noAuth).auth.verifyOtp({ type: "magiclink", token_hash: gl.data.properties!.hashed_token });
  return { id, email, session: v.data.session };
}

beforeAll(async () => {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: SB_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: SB_ANON, SUPABASE_SERVICE_ROLE_KEY: SB_SERVICE, NEXT_PUBLIC_SITE_URL: APP }, stdio: ["ignore", "ignore", "pipe"] });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${APP}/fees`)).status === 200) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch();
}, 300_000);
afterAll(async () => {
  await browser?.close(); server?.kill("SIGTERM");
  const problems = await cleanupUsers(); if (problems.length) throw new Error(problems.join("; "));
}, 300_000);

type Row = { id: string; impact: string; path: string; where: Set<string>; n: number; help: string; sample: string };
async function scan(label: string, sess: Awaited<ReturnType<typeof session>>, paths: string[]) {
  const seen = new Map<string, Row>(); const unreachable: string[] = [];
  for (const [vname, vp] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]] as const) {
    const ctx = await browser.newContext({ viewport: vp, locale: "en-US" }); await ctx.addCookies(cookiesFor(sess.session)); const page = await ctx.newPage();
    for (const path of paths) {
      const r = await page.goto(APP + path, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => null);
      if (!r || r.status() >= 400 || new URL(page.url()).pathname === "/login") { unreachable.push(`${vname} ${path} -> ${r?.status() ?? "no answer"} ${new URL(page.url()).pathname}`); continue; }
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => await (window as Any).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }));
      for (const v of res.violations) {
        const key = `${v.id}|${path}`; const row = seen.get(key) ?? { id: v.id, impact: v.impact, path, where: new Set<string>(), n: 0, help: v.help, sample: v.nodes[0]?.target?.join(" ") ?? "" };
        row.where.add(vname); row.n += v.nodes.length; seen.set(key, row);
      }
    }
    await ctx.close();
  }
  for (const r of seen.values()) console.log(`${["serious", "critical"].includes(r.impact) ? "✕" : "·"} [${label}] [${r.impact}] ${r.id} on ${r.path} (${[...r.where].join("+")}, ${r.n}): ${r.help} — e.g. ${r.sample}`);
  for (const u of unreachable) console.log(`? [${label}] could not check ${u}`);
  return { bad: [...seen.values()].filter((r) => ["serious", "critical"].includes(r.impact)), unreachable };
}

describe("accessibility of signed-in pages", () => {
  it("traveler pages have no serious or critical problems", async () => {
    const t = await session("trav", false);
    const d = await makeDraft({ id: t.id, email: t.email, client: null as Any }, "A1"); ids = { tripId: d.tripId, appId: d.appId };
    const paths = ["/", "/apply", "/travelers", "/trips", `/trips/${ids.tripId}`, "/pass", "/notifications", "/account", "/account/notifications", "/account/password", "/account/privacy", "/family", "/help/chat", "/toolkit", "/conditions", "/stay"];
    const { bad, unreachable } = await scan("traveler", t, paths);
    expect(unreachable.filter((u) => !u.includes("/pass"))).toEqual([]);
    expect(bad.map((b) => `${b.id} ${b.path}`)).toEqual([]);
  }, 600_000);
  it("back-office pages have no serious or critical problems", async () => {
    const a = await session("boss", true);
    const paths = ["/admin", "/admin/queue", `/admin/queue/${ids.appId}`, "/admin/admins", "/admin/agencies", "/admin/ai", "/admin/airports", "/admin/analytics", "/admin/audit", "/admin/branding", "/admin/channels", "/admin/company", "/admin/content", "/admin/discounts", "/admin/eligibility", "/admin/errors", "/admin/features", "/admin/immigration", "/admin/messaging", "/admin/notifications", "/admin/partners", "/admin/prompts", "/admin/reconcile", "/admin/revenue", "/admin/rules", "/admin/settings", "/admin/toolkit", "/admin/tourism", "/agency", "/partner", "/gov"];
    const { bad, unreachable } = await scan("staff", a, paths);
    console.log("unreachable (may be expected for pages needing a role):", unreachable);
    expect(bad.map((b) => `${b.id} ${b.path}`)).toEqual([]);
  }, 900_000);
});
void helperUser;
