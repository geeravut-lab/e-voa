// Browser check of the traveler journey and the Ops console on a phone-sized screen (real Supabase, Stripe TEST API for the session, simulator for partners).
// Starts `next start` itself (run `npm run build` first). The hosted Stripe page cannot be opened from the cloud sandbox, so the test only checks that
// the browser is sent to checkout.stripe.com with a real session, then records the payment the same way the app does.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { HttpImmigrationGateway } from "@/lib/immigration/gateway";
import { syncFlatLists, syncChildLists } from "@/lib/immigration/sync";
import { syncPartnerPackages, handlePartnerCallback } from "@/lib/partners/service";
import { afterPayment } from "@/lib/payments/service";
import { checkDigit } from "@/lib/mrz";

// Playwright is pre-installed globally in the cloud sandbox and resolves through require() from any directory.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any; type BrowserContext = any; type Page = any; type Req = any;
const { chromium } = createRequire(import.meta.url)("playwright");
const { SB_URL, SB_ANON, SB_SERVICE } = process.env as Record<string, string>;
const ref = new URL(SB_URL).hostname.split(".")[0];
const noAuth = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin: SupabaseClient = createClient(SB_URL, SB_SERVICE, noAuth);
const sql = async <T = Record<string, unknown>>(query: string): Promise<T[]> => {
  for (let attempt = 1; ; attempt++) {                // the Management API sometimes answers with an HTML error page: try again
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const text = await r.text();
    try { const j = JSON.parse(text); if (Array.isArray(j)) return j as T[]; throw new Error(text.slice(0, 300)); }
    catch (e) { if (attempt >= 4 || (e as Error).name !== "SyntaxError") throw e; await new Promise((res) => setTimeout(res, 1500 * attempt)); }
  }
};
const PORT = 3190, APP = `http://localhost:${PORT}`, SHOTS = process.env.SHOTS ?? "";
const users: string[] = [];
let server: ChildProcess, browser: Browser, mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void> }, mockBase = "";
let masterWasEmpty = false, catalogueWasEmpty = false; let eligibilityBefore: unknown = undefined;

function cookiesFor(session: unknown) {
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${ref}-auth-token`, size = 3180; const base = { domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };
  if (value.length <= size) return [{ ...base, name, value }];
  return value.match(new RegExp(`.{1,${size}}`, "g"))!.map((v, i) => ({ ...base, name: `${name}.${i}`, value: v }));
}
async function makeUser(label: string, adminRole = false) {
  const email = `p2b-${label}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: `Tester ${label}` } });
  const id = c.data.user!.id; users.push(id);
  if (adminRole) await sql(`insert into public.admins (user_id, is_owner) values ('${id}', false)`);
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(SB_URL, SB_SERVICE, noAuth).auth.verifyOtp({ type: "magiclink", token_hash: gl.data.properties!.hashed_token });
  return { id, email, session: v.data.session };
}
const ctxFor = async (u: Awaited<ReturnType<typeof makeUser>>, w = 390, h = 844): Promise<BrowserContext> => { const c = await browser.newContext({ viewport: { width: w, height: h }, locale: "en-US" }); await c.addCookies(cookiesFor(u.session)); return c; };
const shot = async (p: Page, name: string) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };
const overflowX = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

/** Passport line 2 with correct check digits for the given fields. */
function mrz(num: string, dob: string, exp: string) {
  const l1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<".padEnd(44, "<");
  const n = num.padEnd(9, "<"), a = checkDigit(n), b = checkDigit(dob), c = checkDigit(exp), personal = "<".repeat(14), d = checkDigit("<".repeat(14));
  const comp = checkDigit(n + a + dob + b + exp + c + personal + d);
  return `${l1}\n${n}${a}UTO${dob}${b}F${exp}${c}${personal}${d}${comp}`;
}

beforeAll(async () => {
  masterWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.master_data"))[0].n) === 0;
  catalogueWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.partner_packages"))[0].n) === 0;
  eligibilityBefore = (await sql<{ value: unknown }>("select value from public.platform_settings where key='eligibility'"))[0]?.value;
  mock = createMockServer({ decisionDelayMs: 60, log: () => {} });
  mockBase = `http://127.0.0.1:${await mock.listen(0)}`;
  const gw = new HttpImmigrationGateway({ baseUrl: `${mockBase}/immigration/th/v1`, token: "jwt", from: "thaipass" });
  Object.assign(process.env, { PARTNER_INSURANCE_URL: `${mockBase}/insurance/CIS`, PARTNER_SIM_URL: `${mockBase}/sim`, PARTNER_VIP_URL: `${mockBase}/vip`, PARTNER_BHS_URL: `${mockBase}/bhs`, INSURANCE_G_API_KEY: "g", INSURANCE_TOKEN: "t", PARTNER_SECRET: "mock-secret", PARTNER_PUBLIC_KEY: "mock-public", STRIPE_SECRET_KEY: "proxy-injected" });
  if (masterWasEmpty) { await syncFlatLists(gw); await syncChildLists(gw); }
  await syncPartnerPackages();
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: SB_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: SB_ANON, SUPABASE_SERVICE_ROLE_KEY: SB_SERVICE, NEXT_PUBLIC_SITE_URL: APP, FLIGHT_API_URL: mockBase, PORT: String(PORT) }, stdio: "pipe" });
  server.stderr?.on("data", (d) => { const s = String(d); if (/error/i.test(s) && !/UNDICI/.test(s)) console.error("[next]", s.slice(0, 300)); });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${APP}/fees`)).status === 200) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch();
}, 300_000);

afterAll(async () => {
  await browser?.close(); server?.kill("SIGTERM");
  await Promise.all(users.map(async (id) => {
    const { data } = await admin.from("documents").select("storage_path").eq("owner_id", id);
    if (data?.length) await admin.storage.from("documents").remove(data.map((d) => d.storage_path));
    await admin.auth.admin.deleteUser(id);
  }));
  await sql(eligibilityBefore === undefined ? "delete from public.platform_settings where key='eligibility'" : `update public.platform_settings set value='${JSON.stringify(eligibilityBefore)}'::jsonb where key='eligibility'`);
  const clean = [masterWasEmpty ? "delete from public.master_data; delete from public.master_sync;" : "", catalogueWasEmpty ? "delete from public.partner_packages;" : ""].join(" ").trim();
  if (clean) await sql(clean);
  await mock?.close();
}, 300_000);

describe("traveler journey in the browser", () => {
  it("public pages work on a phone without sideways scrolling", async () => {
    const u = await makeUser("pub"); const ctx = await ctxFor(u); const p = await ctx.newPage();
    for (const path of ["/fees", "/extras", "/eligibility"]) { const r = await p.goto(APP + path); expect(r?.status(), path).toBe(200); expect(await overflowX(p), path).toBe(false); }
    await shot(p, "fees-390"); await p.goto(APP + "/fees"); expect(await p.getByText("Visa fee and service fee are not refundable").count()).toBe(1);
    await ctx.close();
  });

  it("eligibility: says it cannot answer until the admin enters the lists, then answers", async () => {
    const u = await makeUser("elig"); const ctx = await ctxFor(u); const p = await ctx.newPage();
    const nat = (await admin.from("master_data").select("id, extra").eq("name", "nationality").limit(1)).data![0];
    await sql(`delete from public.platform_settings where key='eligibility'`);
    await p.goto(`${APP}/eligibility?n=${nat.id}`);
    expect(await p.getByText("We cannot answer yet").count()).toBe(1);
    const code = String((nat.extra as { CountryCode?: string }).CountryCode ?? "");
    if (code) {
      await sql(`insert into public.platform_settings (key, value) values ('eligibility', '{"voa":["${code}"],"visa_free":[]}') on conflict (key) do update set value=excluded.value`);
      await new Promise((r) => setTimeout(r, 1500));
      await p.goto(`${APP}/eligibility?n=${nat.id}`);
      expect(await p.getByText("You can apply for a Visa on Arrival").count()).toBe(1);
    }
    await ctx.close();
  });

  let ids = { app: "", trip: "" }; let traveler: Awaited<ReturnType<typeof makeUser>>;
  it("wizard: trip with flight lookup → traveler from passport lines → documents → extras → pay (browser is sent to Stripe)", async () => {
    traveler = await makeUser("trav"); const ctx = await ctxFor(traveler); const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: unknown) => errs.push(String(e)));
    const day = new Date(Date.now() + 12 * 86_400_000), iso = (d: Date) => d.toISOString().slice(0, 10);
    await p.goto(`${APP}/apply`);
    await p.getByLabel("Arrival date").fill(iso(day));
    await p.getByLabel("Flight number").first().fill("TG316");
    await p.getByRole("button", { name: "Find" }).click();
    await p.getByText(/Found:/).waitFor({ timeout: 15_000 });
    expect(await p.getByLabel("Time").first().inputValue()).toMatch(/^\d{2}:\d{2}$/);
    await p.getByLabel("Boarded in (country)").selectOption({ index: 1 });
    await p.getByLabel("Purpose of visit").selectOption({ index: 1 });
    await p.getByLabel("First city in Thailand").fill("Bangkok");
    await p.getByLabel("Departure date").fill(iso(new Date(day.getTime() + 10 * 86_400_000)));
    await p.getByLabel("Flight number").nth(1).fill("TG317");
    await p.getByLabel("Airline").nth(1).selectOption({ index: 1 });
    await shot(p, "wizard-1-390");
    expect(await overflowX(p)).toBe(false);
    await p.getByRole("button", { name: "Next" }).click();
    await p.waitForURL(/step=2&trip=/, { timeout: 20_000 });
    ids.trip = new URL(p.url()).searchParams.get("trip")!;

    // step 2: the passport lines fill the form and the check digits are verified
    const dob = "900501", exp = `${String(day.getUTCFullYear() + 5).slice(2)}0301`;
    await p.getByLabel("Read the passport lines").fill(mrz("L898902C3", dob, exp));
    await p.getByRole("button", { name: "Fill in from passport" }).click();
    await p.getByText("Read and verified").waitFor({ timeout: 15_000 });
    expect(await p.getByLabel("Surname").inputValue()).toBe("ERIKSSON");
    expect(await p.getByLabel("Passport number").inputValue()).toBe("L898902C3");
    await p.getByLabel("Title").selectOption({ index: 1 });
    await p.getByLabel("Gender").selectOption({ index: 1 });
    await p.getByLabel("Nationality").selectOption({ index: 1 });
    await p.getByLabel("Passport issue date").fill("2021-03-09");
    await p.getByLabel("Place of issue").fill("Delhi");
    await p.getByLabel("Email").fill(traveler.email);
    await p.getByLabel("Country code").fill("91"); await p.getByLabel("Mobile number").fill("912345678");
    await p.getByLabel("Country of residence").selectOption({ index: 1 });
    await p.getByLabel("State / province").fill("Delhi"); await p.getByLabel("Home address").fill("1 Test Road, Delhi");
    await p.getByLabel("Occupation").selectOption({ index: 1 }); await p.getByLabel("Yearly income").selectOption({ index: 1 });
    await p.getByLabel("Type of stay").selectOption({ index: 1 }); await p.getByLabel("Hotel / place name").fill("Test Hotel");
    await p.getByLabel("Province").selectOption({ index: 1 });
    await p.waitForFunction(() => (document.querySelector('select[name="district_id"]') as HTMLSelectElement | null)?.options.length! > 1, null, { timeout: 15_000 });
    await p.getByLabel("District").selectOption({ index: 1 });
    await p.waitForFunction(() => (document.querySelector('select[name="sub_district_id"]') as HTMLSelectElement | null)?.options.length! > 1, null, { timeout: 15_000 });
    await p.getByLabel("Sub-district").selectOption({ index: 1 });
    await p.getByLabel("Postal code").fill("10330"); await p.getByLabel("Street address").fill("1 Test Road");
    await p.getByLabel("Contact person or booking reference").fill("BK123");
    await shot(p, "wizard-2-390");
    await p.getByRole("button", { name: "Save traveler" }).click();
    await p.waitForURL(/app=/, { timeout: 20_000 });
    ids.app = new URL(p.url()).searchParams.get("app")!;

    // documents: one upload per slot, each shows "Uploaded"
    mkdirSync("/tmp/p2b", { recursive: true }); const file = "/tmp/p2b/doc.jpg"; writeFileSync(file, await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 90, g: 140, b: 200 } } }).jpeg().toBuffer());
    for (const [i, label] of ["Passport photo page", "Photo", "Return ticket", "Accommodation", "Proof of funds"].entries()) {
      const slot = p.locator("form", { has: p.locator(`input[type=file][aria-label="${label}"]`) });
      await slot.locator("input[type=file]").setInputFiles(file);
      await slot.getByRole("button").click();
      await slot.getByText("Uploaded", { exact: true }).waitFor({ timeout: 30_000 }).catch(() => { throw new Error(`document ${i} (${label}) was not accepted`); });
    }
    await shot(p, "wizard-2b-390");
    await p.getByRole("link", { name: "Next" }).click();
    await p.waitForURL(/step=3/, { timeout: 20_000 });

    // step 3: insurance + eSIM
    await p.getByText("Travel insurance").first().waitFor();
    const radios = p.locator('input[type=radio][name^="addon:"]:not([value=""])');
    expect(await radios.count()).toBeGreaterThan(1);
    const names = new Set<string>();
    for (const cat of ["insurance", "esim"]) { const r = p.locator(`input[type=radio][name$=":${cat}"]:not([value=""])`).first(); if (await r.count()) { await r.check(); names.add(cat); } }
    expect(names.size).toBe(2); await shot(p, "wizard-3-390");
    await p.getByRole("button", { name: "Next" }).click();
    await p.waitForURL(/step=4/, { timeout: 20_000 });

    // step 4: the total is shown, the refund rule is stated before paying, and Pay sends the browser to Stripe
    expect(await p.getByText("not refundable once paid").count()).toBe(1);
    expect(await p.getByText("Test mode").count()).toBe(1);
    await shot(p, "wizard-4-390");
    const toStripe = p.waitForRequest((r: Req) => r.url().startsWith("https://checkout.stripe.com/"), { timeout: 40_000 });
    await p.route("https://checkout.stripe.com/**", (r: Req) => r.abort());
    await p.getByRole("button", { name: /^Pay/ }).click();
    expect((await toStripe).url()).toMatch(/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/);
    const pay = (await sql<{ id: string; amount_thb: string; status: string }>(`select id, amount_thb, status from public.payments where owner_id='${traveler.id}'`))[0];
    expect(pay.status).toBe("pending"); expect(Number(pay.amount_thb)).toBeGreaterThan(2600);
    expect(errs).toEqual([]);
    await ctx.close();
  });

  it("after payment the traveler sees the status, the receipt; after approval the pass, the QR check page and the offline picture", async () => {
    const pay = (await sql<{ id: string }>(`select id from public.payments where owner_id='${traveler.id}'`))[0];
    const amount = Number((await sql<{ a: string }>(`select amount_thb a from public.payments where id='${pay.id}'`))[0].a);
    const pi = await fetch("https://api.stripe.com/v1/payment_intents", { method: "POST", headers: { Authorization: "Bearer proxy-injected", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ amount: String(Math.round(amount * 100)), currency: "thb", payment_method: "pm_card_visa", confirm: "true", "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never" }) }).then((r) => r.json());
    expect((await admin.rpc("mark_payment_paid", { p_id: pay.id, p_intent: pi.id })).error).toBeNull();
    await afterPayment(pay.id);
    const ctx = await ctxFor(traveler); const p = await ctx.newPage();
    await p.goto(`${APP}/pay/return?payment=${pay.id}`);                                  // the return page asks Stripe/DB, not the address
    await p.getByText("Payment received").waitFor({ timeout: 20_000 });
    await shot(p, "pay-return-390");
    await p.goto(`${APP}/receipts/${pay.id}`); expect(await p.getByText(/RC-\d{2}-\d{6}/).count()).toBeGreaterThan(0); await shot(p, "receipt-390");
    await p.goto(`${APP}/trips`); await p.getByText(/EV-\d{2}-\d{6}/).first().waitFor();
    await shot(p, "trips-390");
    // approve the way Immigration would (the insurance callback + decision are covered in phase2.live.test.ts; here the state is set through the same function)
    await admin.rpc("transition_application", { p_id: ids.app, p_to: "submitted", p_reason: null, p_source: "immigration", p_actor: null, p_only_from: ["pre_check", "action_required"] });
    await admin.rpc("transition_application", { p_id: ids.app, p_to: "approved", p_reason: null, p_source: "immigration", p_actor: null, p_only_from: ["submitted"] });
    await p.goto(`${APP}/trips/${ids.app}`); await p.getByText("Open E-VOA pass").waitFor({ timeout: 15_000 });
    await shot(p, "trip-detail-390");
    await p.goto(`${APP}/pass/${ids.app}`); await p.locator('[role=img] svg').first().waitFor();
    expect(await overflowX(p)).toBe(false); await shot(p, "pass-390");
    const card = await p.request.get(`${APP}/pass/${ids.app}/card`); expect(card.status()).toBe(200); expect(card.headers()["content-type"]).toContain("image/svg+xml");
    const { passToken } = await import("@/lib/passes");
    const v = await p.goto(`${APP}/v/${passToken(ids.app)}`); expect(v?.status()).toBe(200); expect(await p.getByText("Approved").count()).toBeGreaterThan(0);
    await p.goto(`${APP}/v/${passToken(ids.app).slice(0, -3)}abc`); expect(await p.getByText("This code is not valid").count()).toBe(1);
    // another signed-in traveler cannot open this pass
    const other = await makeUser("other"); const c2 = await ctxFor(other); const p2 = await c2.newPage();
    expect((await p2.goto(`${APP}/pass/${ids.app}`))?.status()).toBe(404); expect((await p2.goto(`${APP}/trips/${ids.app}`))?.status()).toBe(404); expect((await p2.goto(`${APP}/receipts/${pay.id}`))?.status()).toBe(404);
    await c2.close(); await ctx.close();
  });

  it("Ops console: staff see the queue and the detail; travelers get 404; actions work", async () => {
    const staff = await makeUser("ops", true); const ctx = await ctxFor(staff, 1280, 800); const p = await ctx.newPage();
    await p.goto(`${APP}/admin/queue?g=all`); await p.getByText(/EV-\d{2}-\d{6}/).first().waitFor({ timeout: 20_000 }); await shot(p, "ops-queue-1280");
    await p.goto(`${APP}/admin/queue/${ids.app}`); await p.getByText("Approval and rejection come only from Thai Immigration").waitFor();
    await p.getByLabel("Write a note").fill("checked by test"); await p.getByRole("button", { name: "Add note" }).click();
    await p.getByText("checked by test").first().waitFor({ timeout: 15_000 }); await shot(p, "ops-detail-1280");
    const t = await ctxFor(traveler); const tp = await t.newPage();
    expect((await tp.goto(`${APP}/admin/queue`))?.status()).toBe(404); expect((await tp.goto(`${APP}/admin/queue/${ids.app}`))?.status()).toBe(404);
    expect((await sql<{ n: number }>(`select count(*) n from public.application_notes where application_id='${ids.app}'`))[0].n).toBe(1);
    expect((await traveler_client().from("application_notes").select("id")).data).toEqual([]);          // travelers never see notes
    await t.close(); await ctx.close();
  });
});
function traveler_client() { return createClient(SB_URL, SB_ANON, noAuth); }
