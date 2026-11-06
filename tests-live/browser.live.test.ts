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
import { cleanupUsers, makeDraft } from "./helpers";
import { applyForPartner, savePackage } from "@/lib/partner-portal/service";
import { applyForAgency } from "@/lib/agency/service";

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
const gone = async (p: Page, url: string) => { await p.goto(url); await p.waitForTimeout(1000); const t = (await p.locator("body").innerText()).toLowerCase(); if (!(t.includes("404") || t.includes("could not be found"))) console.log("NOT 404:", url, t.slice(0, 200)); return t.includes("404") || t.includes("could not be found"); };
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
  await cleanupUsers();
  await sql(eligibilityBefore === undefined ? "delete from public.platform_settings where key='eligibility'" : `update public.platform_settings set value='${JSON.stringify(eligibilityBefore)}'::jsonb where key='eligibility'`);
  const clean = [masterWasEmpty ? "delete from public.master_data; delete from public.master_sync;" : "", catalogueWasEmpty ? "delete from public.partner_packages;" : ""].join(" ").trim();
  if (clean) await sql(clean);
  await mock?.close();
}, 300_000);

const ids = { app: "", trip: "" }; let traveler: Awaited<ReturnType<typeof makeUser>>;
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
      await new Promise((r) => setTimeout(r, 31_000));   // settings are cached for 30 s per server
      await p.goto(`${APP}/eligibility?n=${nat.id}`);
      expect(await p.getByText("You can apply for a Visa on Arrival").count()).toBe(1);
    }
    await ctx.close();
  });

  it("wizard: trip with flight lookup → traveler from passport lines → documents → extras → pay (browser is sent to Stripe)", async () => {
    traveler = await makeUser("trav"); const ctx = await ctxFor(traveler); const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: unknown) => errs.push(String(e)));
    const day = new Date(Date.now() + 12 * 86_400_000), iso = (d: Date) => d.toISOString().slice(0, 10);
    await p.goto(`${APP}/apply`);
    await p.getByLabel("Arrival date", { exact: true }).fill(iso(day));
    await p.getByLabel("Flight number", { exact: true }).first().fill("TG316");
    await p.getByRole("button", { name: "Find" }).click();
    await p.getByText(/Found:|Flight not found/).first().waitFor({ timeout: 15_000 });
    expect(await p.locator("[role=status]").allInnerTexts(), "flight lookup note").toEqual([expect.stringContaining("Found:")]);
    expect(await p.getByLabel("Time", { exact: true }).first().inputValue()).toMatch(/^\d{2}:\d{2}$/);
    await p.getByLabel("Boarded in (country)", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Purpose of visit", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("First city in Thailand", { exact: true }).fill("Bangkok");
    await p.getByLabel("Departure date", { exact: true }).fill(iso(new Date(day.getTime() + 10 * 86_400_000)));
    await p.getByLabel("Flight number", { exact: true }).nth(1).fill("TG317");
    await p.getByLabel("Airline", { exact: true }).nth(1).selectOption({ index: 1 });
    await shot(p, "wizard-1-390");
    expect(await overflowX(p)).toBe(false);
    await p.getByRole("button", { name: "Next" }).click();
    await p.waitForURL(/step=2&trip=/, { timeout: 20_000 });
    ids.trip = new URL(p.url()).searchParams.get("trip")!;

    // step 2 (a): a PHOTO of the passport page is read on the device (synthetic picture with the two lines at the bottom)
    const dob = "900501", exp = `${String(day.getUTCFullYear() + 5).slice(2)}0301`;
    mkdirSync("/tmp/p2b", { recursive: true });
    const lines = mrz("L898902C3", dob, exp).split("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="900"><rect width="100%" height="100%" fill="white"/><rect x="60" y="60" width="300" height="360" fill="rgb(200,205,215)"/><text x="420" y="140" font-size="40" font-family="DejaVu Sans, sans-serif" fill="rgb(40,40,40)">PASSPORT  UTO</text>${lines.map((l, i) => `<text x="75" y="${760 + i * 62}" font-size="46" font-family="DejaVu Sans Mono, monospace" fill="black" xml:space="preserve">${l.replace(/</g, "&lt;")}</text>`).join("")}</svg>`;
    writeFileSync("/tmp/p2b/passport-photo.png", await sharp(Buffer.from(svg)).png().toBuffer());
    await p.locator("#scan-input").setInputFiles("/tmp/p2b/passport-photo.png");
    await p.getByText(/Read and verified|check digit does not match|could not read/).first().waitFor({ timeout: 120_000 });
    expect(await p.getByLabel("Surname", { exact: true }).inputValue(), "passport photo was read").toBe("ERIKSSON");
    await shot(p, "wizard-2-scan-390");
    // step 2 (b): the two lines typed or pasted fill the form and the check digits are verified
    await p.getByLabel("Read the passport lines", { exact: true }).fill(mrz("L898902C3", dob, exp));
    await p.getByRole("button", { name: "Fill in from passport" }).click();
    await p.getByText("Read and verified").waitFor({ timeout: 15_000 });
    expect(await p.getByLabel("Surname", { exact: true }).inputValue()).toBe("ERIKSSON");
    expect(await p.getByLabel("Passport number", { exact: true }).inputValue()).toBe("L898902C3");
    await p.getByLabel("Title", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Gender", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Nationality", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Passport issue date", { exact: true }).fill("2021-03-09");
    await p.getByLabel("Place of issue", { exact: true }).fill("Delhi");
    await p.getByLabel("Email", { exact: true }).fill(traveler.email);
    await p.getByLabel("Country code", { exact: true }).fill("91"); await p.getByLabel("Mobile number", { exact: true }).fill("912345678");
    await p.getByLabel("Country of residence", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("State / province", { exact: true }).fill("Delhi"); await p.getByLabel("Home address", { exact: true }).fill("1 Test Road, Delhi");
    await p.getByLabel("Occupation", { exact: true }).selectOption({ index: 1 }); await p.getByLabel("Yearly income", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Type of stay", { exact: true }).selectOption({ index: 1 }); await p.getByLabel("Hotel / place name", { exact: true }).fill("Test Hotel");
    await p.getByLabel("Province", { exact: true }).selectOption({ index: 1 });
    await p.waitForFunction(() => (document.querySelector('select[name="district_id"]') as HTMLSelectElement | null)?.options.length! > 1, null, { timeout: 15_000 });
    await p.waitForTimeout(2500);
    console.log("GEO", JSON.stringify(await p.evaluate(() => ["city_id", "district_id", "sub_district_id"].map((n) => { const e = document.querySelector(`select[name=${n}]`) as HTMLSelectElement; return { n, disabled: e.disabled, value: e.value, options: e.options.length }; }))));
    await p.getByLabel("District", { exact: true }).selectOption({ index: 1 });
    await p.waitForFunction(() => (document.querySelector('select[name="sub_district_id"]') as HTMLSelectElement | null)?.options.length! > 1, null, { timeout: 15_000 });
    await p.getByLabel("Sub-district", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("Postal code", { exact: true }).fill("10330"); await p.getByLabel("Street address", { exact: true }).fill("1 Test Road");
    await p.getByLabel("Contact person or booking reference", { exact: true }).fill("BK123");
    await shot(p, "wizard-2-390");
    await p.getByRole("button", { name: "Save traveler" }).click();
    await p.waitForURL(/app=/, { timeout: 20_000 });
    ids.app = new URL(p.url()).searchParams.get("app")!;

    // documents: one upload per slot, each shows "Uploaded"
    const file = "/tmp/p2b/doc.jpg"; writeFileSync(file, await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 90, g: 140, b: 200 } } }).jpeg().toBuffer());
    for (const [i, label] of ["Passport photo page", "Face photo", "Return flight ticket", "Accommodation booking", "Proof of funds"].entries()) {
      const slot = p.locator("form", { has: p.locator(`input[type=file][aria-label="${label}"]`) });
      if (label === "Face photo") {                                       // the face check runs in the browser as soon as a photo is chosen (real group photo shipped with the detector's package)
        await slot.locator("input[type=file]").setInputFiles("node_modules/@vladmandic/face-api/demo/sample1.jpg");
        await slot.getByText(/More than one face/).waitFor({ timeout: 60_000 });
        await slot.locator("input[type=file]").setInputFiles("node_modules/@vladmandic/face-api/demo/sample2.jpg");
        await slot.getByText(/Photo advice|One face, well placed/).waitFor({ timeout: 60_000 });
        expect(await slot.getByText(/More than one face/).count(), "advice follows the newly chosen photo").toBe(0);
      }
      await slot.locator("input[type=file]").setInputFiles(file);
      await slot.locator("button[type=submit]").click();
      if (label === "Face photo") await slot.getByText(/Photo advice/).waitFor({ timeout: 30_000 });
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
    // the full review shows what was typed, and Pay stays off until the agreement, the declaration and the signature are done
    expect(await p.getByText("ERIKSSON").count()).toBeGreaterThan(0); expect(await p.getByText("Test Hotel").count()).toBeGreaterThan(0); expect(await p.getByText("Your trip").count()).toBe(1);
    const payBtn = p.getByRole("button", { name: /^Pay/ });
    expect(await payBtn.isDisabled()).toBe(true);
    for (const n of ["consent_terms", "consent_immigration", "consent_partners", "declare"]) await p.locator(`input[name=${n}]`).check();
    expect(await payBtn.isDisabled(), "still needs the signature").toBe(true);
    const pad = p.getByRole("img", { name: "Signature area" }); const box = (await pad.boundingBox())!;
    await p.mouse.move(box.x + 20, box.y + 60); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(box.x + 20 + i * 15, box.y + 60 + Math.sin(i) * 30); await p.mouse.up();
    await shot(p, "wizard-4b-390");
    await p.waitForFunction(() => !(document.querySelector("button[type=submit][aria-busy]") as HTMLButtonElement | null)?.disabled, null, { timeout: 5000 }).catch(() => undefined);
    expect(await payBtn.isDisabled()).toBe(false);
    await payBtn.click();
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
    // while the application waits, the traveler can upgrade or cancel; the cost of cancelling is stated first
    await p.goto(`${APP}/trips/${ids.app}`); await p.getByText("Change or cancel").waitFor({ timeout: 15_000 });
    expect(await p.getByRole("button", { name: /Upgrade to Express/ }).count()).toBe(1);
    await p.getByRole("button", { name: "Cancel this application" }).click();
    expect(await p.getByText("the visa fee and the service fee are not refunded", { exact: false }).count()).toBe(1);
    await shot(p, "trip-manage-390");
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
    expect(await gone(p2, `${APP}/pass/${ids.app}`)).toBe(true); expect(await gone(p2, `${APP}/trips/${ids.app}`)).toBe(true); expect(await gone(p2, `${APP}/receipts/${pay.id}`)).toBe(true);
    await c2.close(); await ctx.close();
  });

  it("Ops console: staff see the queue and the detail; travelers get 404; actions work", async () => {
    const staff = await makeUser("ops", true); const ctx = await ctxFor(staff, 1280, 800); const p = await ctx.newPage();
    await p.goto(`${APP}/admin/queue?g=all`); await p.getByText(/EV-\d{2}-\d{6}/).first().waitFor({ timeout: 20_000 }); await shot(p, "ops-queue-1280");
    await p.goto(`${APP}/admin/queue/${ids.app}`); await p.getByText("Approval and rejection come only from Thai Immigration").waitFor();
    await p.getByLabel("Write a note", { exact: true }).fill("checked by test"); await p.getByRole("button", { name: "Add note" }).click();
    await p.getByText("checked by test").first().waitFor({ timeout: 15_000 }); await shot(p, "ops-detail-1280");
    const t = await ctxFor(traveler); const tp = await t.newPage();
    expect(await gone(tp, `${APP}/admin/queue`)).toBe(true); expect(await gone(tp, `${APP}/admin/queue/${ids.app}`)).toBe(true);
    expect((await sql<{ n: number }>(`select count(*) n from public.application_notes where application_id='${ids.app}'`))[0].n).toBe(1);
    expect((await traveler_client().from("application_notes").select("id")).data).toEqual([]);          // travelers never see notes
    await t.close(); await ctx.close();
  });
});
describe("public pages, status check, help and content", () => {
  it("anyone can check a status with reference + passport + date of birth; a wrong detail gives the same plain answer", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" }); const p = await ctx.newPage();
    const ref = (await sql<{ ref_no: string }>(`select ref_no from public.applications where id='${ids.app}'`))[0].ref_no;
    await p.goto(`${APP}/status`);
    const fill = async (r: string, pass: string, dob: string) => { await p.getByLabel("Application reference", { exact: true }).fill(r); await p.getByLabel("Passport number", { exact: true }).fill(pass); await p.getByLabel("Date of birth", { exact: true }).fill(dob); await p.getByRole("button", { name: "Check status" }).click(); };
    await fill(ref, "L898902C3", "1990-05-01"); await p.getByText(/Approved —/).waitFor({ timeout: 15_000 });
    await fill(ref, "L898902C4", "1990-05-01"); await p.getByText("No application matches these details").waitFor({ timeout: 15_000 });
    await fill("EV-26-999999", "L898902C3", "1990-05-01"); await p.getByText("No application matches these details").waitFor({ timeout: 15_000 });
    await shot(p, "status-390"); expect(await overflowX(p)).toBe(false);
    await ctx.close();
  });

  it("help searches the questions; checklist, airport guide, official channels, privacy and terms open; sitemap and robots are right", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" }); const p = await ctx.newPage();
    await p.goto(`${APP}/help`); const all = await p.locator("details").count(); expect(all).toBeGreaterThanOrEqual(10);
    await p.getByPlaceholder("Search the questions").fill("refund"); expect(await p.locator("details").count()).toBeGreaterThan(0); expect(await p.locator("details").count()).toBeLessThan(all);
    await p.getByPlaceholder("Search the questions").fill("zzzzqqq"); await p.getByText("No question matches").waitFor();
    await p.getByPlaceholder("Search the questions").fill(""); await p.locator("summary").first().click(); expect(await p.locator("details[open]").count()).toBe(1);
    expect(await p.locator('script[type="application/ld+json"]').count()).toBe(1); await shot(p, "help-390");
    for (const [path, text] of [["/prepare", "Passport"], ["/guide", "Follow the signs"], ["/official", "Avoid look-alike sites"], ["/privacy", "Who we are"], ["/terms", "Fees and refunds"]] as const) { await p.goto(APP + path); expect(await p.getByText(text).count(), path).toBeGreaterThan(0); expect(await overflowX(p), path).toBe(false); }
    const sm = await (await p.request.get(`${APP}/sitemap.xml`)).text(); expect(sm).toContain("/fees"); expect(sm).not.toContain("/admin");
    const rb = await (await p.request.get(`${APP}/robots.txt`)).text(); expect(rb).toContain("Disallow: /admin"); expect(rb).toContain("Sitemap:");
    await ctx.close();
  });

  it("the traveler book lists the saved traveler (not deletable while on an application); staff see the declaration and the error page", async () => {
    const ctx = await ctxFor(traveler); const p = await ctx.newPage();
    await p.goto(`${APP}/travelers`); await p.getByText("ANNA").first().waitFor({ timeout: 15_000 });
    expect(await p.getByRole("link", { name: "Use for a new trip" }).count()).toBe(1); expect(await p.getByRole("button", { name: "Delete" }).count()).toBe(0); await shot(p, "travelers-390");
    const receipt = (await sql<{ id: string }>(`select id from public.payments where owner_id='${traveler.id}'`))[0].id;
    const pdf = await p.request.get(`${APP}/receipts/${receipt}/pdf`); expect(pdf.status()).toBe(200); expect(pdf.headers()["content-type"]).toBe("application/pdf"); expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    const staff = await makeUser("ops2", true); const sctx = await ctxFor(staff, 1280, 800); const sp2 = await sctx.newPage();
    await sp2.goto(`${APP}/admin/queue/${ids.app}`); await sp2.getByText("Declaration:", { exact: false }).first().waitFor({ timeout: 15_000 });
    await sp2.goto(`${APP}/admin/errors`); expect(await sp2.getByText("Errors").count()).toBeGreaterThan(0);
    await sctx.close(); await ctx.close();
  });
});
describe("mobile menu", () => {
  it("Apply is dark unless open; More turns blue when the open page is in it; the back-office title sits above its pages and lights up only on the back-office home", async () => {
    const staff = await makeUser("nav", true); const ctx = await ctxFor(staff); const p = await ctx.newPage();
    const bar = p.locator("nav[aria-label=Main]").last(); const label = bar.locator("a[href='/apply'] span").last(), more = bar.locator("button[aria-haspopup=dialog]");
    const col = (l: ReturnType<typeof p.locator>) => l.evaluate((e: Element) => getComputedStyle(e).color);
    await p.goto(`${APP}/`); await p.waitForTimeout(800); const dark = await col(label), grey = await col(more);
    await p.goto(`${APP}/apply`); await p.waitForTimeout(800); expect(await col(label), "Apply is blue on its own page").not.toBe(dark);
    await p.goto(`${APP}/fees`); await p.waitForTimeout(800); expect(await col(label)).toBe(dark); expect(await col(more), "More is blue on a page of the sheet").not.toBe(grey);
    await p.goto(`${APP}/admin/queue`); await p.waitForTimeout(800); await more.click();
    const sheet = p.locator("[role=dialog]"); const rows = await sheet.locator("button").evaluateAll((els: Element[]) => els.map((e) => ({ t: (e as HTMLElement).innerText.trim(), cur: e.getAttribute("aria-current") })));
    const head = rows.findIndex((r: { t: string }) => r.t.toLowerCase() === "back office"); expect(head, JSON.stringify(rows)).toBeGreaterThan(0);
    expect(rows[head].cur).toBeNull(); expect(rows[head + 1].cur, "the open page is the one highlighted").toBe("page");
    const box = await sheet.locator("button[aria-current=page]").boundingBox(); expect(box!.y).toBeGreaterThan(0); expect(box!.y + box!.height).toBeLessThan(844);
    await p.keyboard.press("Escape"); await p.goto(`${APP}/admin`); await p.waitForTimeout(800); await more.click();
    const home = await sheet.locator("button[aria-current=page]").allInnerTexts(); expect(home.map((x: string) => x.toLowerCase())).toEqual(["back office"]);
    await ctx.close();
  });
});
describe("uploads: selfie and viewing", () => {
  it("the face photo can be taken with the camera (face check runs, file goes through the normal upload) and every uploaded file can be viewed", async () => {
    const u = await makeUser("selfie");
    const d = await makeDraft({ id: u.id, email: u.email } as never, "APR");
    await admin.from("documents").delete().eq("application_id", d.appId).eq("kind", "photo");          // the photo is the one missing
    const fake = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    try {
      const ctx = await fake.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", permissions: ["camera"] }); await ctx.addCookies(cookiesFor(u.session)); const p = await ctx.newPage();
      const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(String(e)));
      await p.goto(`${APP}/apply?step=2&trip=${d.tripId}&app=${d.appId}`); await p.waitForSelector("text=Take a selfie", { timeout: 20_000 });
      const slot = p.locator("form", { has: p.locator("input[name=kind][value=photo]") });
      expect(await slot.getByRole("button", { name: "View" }).count(), "no file yet, nothing to view").toBe(0);
      await slot.getByRole("button", { name: /Take a selfie/ }).click();
      const dlg = p.getByRole("dialog", { name: "Take your photo" }); await dlg.waitFor();
      await p.waitForFunction(() => { const v = document.querySelector("video") as HTMLVideoElement | null; return !!v && v.videoWidth > 0; }, null, { timeout: 15_000 });
      await shot(p, "selfie-live");
      await dlg.getByRole("button", { name: "Take photo" }).click();
      await dlg.getByRole("button", { name: "Use this photo" }).waitFor(); await dlg.getByRole("button", { name: "Retake" }).click();          // retake works
      await dlg.getByRole("button", { name: "Take photo" }).click(); await dlg.getByRole("button", { name: "Use this photo" }).click();
      await dlg.waitFor({ state: "detached" });
      const got = await slot.locator("input[type=file][name=file]").evaluate((el: HTMLInputElement) => ({ n: el.files?.length ?? 0, type: el.files?.[0]?.type, name: el.files?.[0]?.name }));
      expect(got).toMatchObject({ n: 1, type: "image/jpeg" }); expect(got.name).toMatch(/^selfie-/);
      await slot.getByRole("status").waitFor({ timeout: 90_000 });          // the face advice appears for the captured picture, before it is sent
      await slot.getByRole("button", { name: "Upload" }).click();
      await slot.getByRole("button", { name: "View" }).waitFor({ timeout: 30_000 });          // after the upload the file can be viewed
      const row = (await admin.from("documents").select("id, mime, kind").eq("application_id", d.appId).eq("kind", "photo").is("deleted_at", null)).data!; expect(row).toHaveLength(1); expect(row[0].mime).toBe("image/jpeg");
      await slot.getByRole("button", { name: "View" }).click();
      const viewer = p.getByRole("dialog", { name: "Photo" }); await viewer.waitFor();
      const img = viewer.locator("img"); await img.waitFor();
      await p.waitForFunction(() => { const i = document.querySelector("[role=dialog] img") as HTMLImageElement | null; return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15_000 });
      expect(await img.evaluate((i: HTMLImageElement) => i.getAttribute("src"))).toBe(`/api/documents/${row[0].id}`);
      await shot(p, "doc-viewer");
      await p.keyboard.press("Escape"); await viewer.waitFor({ state: "detached" });
      // another signed-in person gets nothing from the same address
      const other = await makeUser("selfie-other"); const c2 = await fake.newContext(); await c2.addCookies(cookiesFor(other.session));
      const r = await c2.request.get(`${APP}/api/documents/${row[0].id}`); expect(r.status()).toBe(404);
      // the trip page lists every uploaded file with a viewer
      await p.goto(`${APP}/trips/${d.appId}`); await p.waitForSelector("text=Your uploaded documents", { timeout: 15_000 });
      expect(await p.locator("section", { hasText: "Your uploaded documents" }).getByRole("button", { name: "View" }).count()).toBeGreaterThanOrEqual(5);
      expect(errs).toEqual([]);
      await ctx.close(); await c2.close();
    } finally { await fake.close(); }
  }, 240_000);

  it("without a camera the selfie button falls back to the phone's camera input, and a denied camera says what to do", async () => {
    const u = await makeUser("selfie2");
    const d = await makeDraft({ id: u.id, email: u.email } as never, "APR");
    await admin.from("documents").delete().eq("application_id", d.appId).eq("kind", "photo");
    const ctx = await ctxFor(u); const p = await ctx.newPage();
    await p.addInitScript(() => { Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true }); });
    await p.goto(`${APP}/apply?step=2&trip=${d.tripId}&app=${d.appId}`); await p.waitForSelector("text=Take a selfie", { timeout: 20_000 });
    const input = p.locator("input[capture=user]"); expect(await input.count()).toBe(1);
    expect(await input.evaluate((e: HTMLInputElement) => e.accept)).toBe("image/*");
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" }); await ctx2.addCookies(cookiesFor(u.session)); const p2 = await ctx2.newPage();
    await p2.addInitScript(() => { Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: () => Promise.reject(new DOMException("denied", "NotAllowedError")) }, configurable: true }); });
    await p2.goto(`${APP}/apply?step=2&trip=${d.tripId}&app=${d.appId}`); await p2.getByRole("button", { name: /Take a selfie/ }).click();
    const al = p2.locator("p[role=alert]"); await al.waitFor(); expect(await al.innerText()).toMatch(/Allow camera access/);
    await p2.getByRole("button", { name: "Close" }).click(); await ctx2.close();
  }, 120_000);
});

describe("partner and agency pages", () => {
  it("registration forms, the pending notice and the active dashboards render on a phone and a desktop without sideways scrolling", async () => {
    const pt = await makeUser("pt-page"), ag = await makeUser("ag-page"), staff = await makeUser("adm-page", true), plain = await makeUser("plain-page");
    // a visitor with no company sees the registration form
    for (const [w, h] of [[390, 844], [1280, 800]] as const) {
      const c = await ctxFor(plain, w, h); const p = await c.newPage();
      await p.goto(`${APP}/partner`); await p.waitForSelector("text=Register your company", { timeout: 20_000 }); expect(await overflowX(p)).toBe(false); await shot(p, `partner-join-${w}`);
      await p.goto(`${APP}/agency`); await p.waitForSelector("text=Register your agency", { timeout: 20_000 }); await shot(p, `agency-join-${w}`); expect(await overflowX(p), `agency join ${w}: ${await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)).join(" | "))}`).toBe(false);
      await c.close();
    }
    // pending → active partner
    const a = await applyForPartner(pt.id, { name: "Browser SIM Co", provider: "sim", contact_name: "Pim Partner", contact_email: "p@example.com", contact_phone: "+66 2 000 0000" }); if (!a.ok) throw new Error(a.error);
    const ag1 = await applyForAgency(ag.id, { name: "Browser Travel Co", contact_name: "Anan Agent", contact_email: "a@example.com", contact_phone: "+66 2 000 0000", country: "Thailand", license_no: "" }); if (!ag1.ok) throw new Error(ag1.error);
    try {
      const c = await ctxFor(pt); const p = await c.newPage();
      await p.goto(`${APP}/partner`); await p.waitForSelector("text=waiting for approval"); await shot(p, "partner-pending");
      await admin.from("partners").update({ status: "active" }).eq("id", a.id);
      const saved = await savePackage(pt.id, { category: "esim", name: "Browser eSIM 5GB", detail: "5 GB", terms: "", price_thb: 300, active: true }); if (!saved.ok) throw new Error(saved.error);
      for (const [w, h] of [[390, 844], [1280, 800]] as const) {
        const c2 = await ctxFor(pt, w, h); const p2 = await c2.newPage();
        await p2.goto(`${APP}/partner`); await p2.waitForSelector("text=Redeem a voucher", { timeout: 20_000 }); expect(await overflowX(p2), `partner dashboard ${w}: ${await p2.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 4).map((e) => e.tagName + "." + String(e.className).slice(0, 70)).join(" | "))}`).toBe(false);
        expect(await p2.locator("input[name=name]").first().inputValue()).toBe("Browser eSIM 5GB");
        await p2.getByPlaceholder("TP-XXXXXXXX").fill("TP-ZZZZZZZZ"); await p2.getByRole("button", { name: "Redeem", exact: true }).click();
        await p2.getByText("not valid for your company").waitFor(); await shot(p2, `partner-active-${w}`);
        const csv = await c2.request.get(`${APP}/partner/settlement.csv`); expect(csv.status()).toBe(200); expect(await csv.text()).toContain("TOTAL");
        await c2.close();
      }
      expect((await (await browser.newContext()).request.get(`${APP}/partner/settlement.csv`)).status(), "signed-out people get nothing").toBe(401);
      await c.close();
      // staff console
      const cs = await ctxFor(staff, 1280, 800); const ps = await cs.newPage();
      await ps.goto(`${APP}/admin/partners`); await ps.waitForSelector("text=Browser SIM Co", { timeout: 20_000 }); expect(await overflowX(ps)).toBe(false); await shot(ps, "admin-partners");
      await ps.goto(`${APP}/admin/agencies`); await ps.waitForSelector("text=Browser Travel Co"); expect(await overflowX(ps)).toBe(false);
      await cs.close();
      // the plain traveler cannot open the staff pages
      const cp = await ctxFor(plain); const pp = await cp.newPage(); await gone(pp, `${APP}/admin/partners`); await cp.close();
    } finally {
      await admin.from("partner_packages").delete().eq("partner_id", a.id); await admin.from("partners").delete().eq("id", a.id); await admin.from("agencies").delete().eq("id", ag1.id);
    }
  }, 240_000);
});
function traveler_client() { return createClient(SB_URL, SB_ANON, noAuth); }
