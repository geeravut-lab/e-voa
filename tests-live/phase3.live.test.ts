// Live checks for the closing items against the REAL Supabase project, the REAL Stripe TEST API and the partner simulator:
// rate limit, consent + signed declaration, autosave drafts, upgrade to Express, cancel with add-on refund, e-mail (receipt PDF attached, to a local fake of the mail service), error log.
// The hosted Stripe page cannot be opened from the sandbox, so "the customer pays" is a real Stripe test PaymentIntent recorded exactly as the app records it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { HttpImmigrationGateway } from "@/lib/immigration/gateway";
import { syncFlatLists } from "@/lib/immigration/sync";
import { createDraftApplication, saveApplicationDocument, upsertTraveler, cancelByTraveler } from "@/lib/applications/service";
import { startCheckout, afterPayment, startUpgradeCheckout, upgradeQuote, refundAddon } from "@/lib/payments/service";
import { handlePartnerCallback, offersFor, setAddons, syncPartnerPackages } from "@/lib/partners/service";
import { rateLimit } from "@/lib/ratelimit";
import { recordConsent, decodeSignature } from "@/lib/compliance";
import { saveDraft, loadDraft, deleteDrafts } from "@/lib/applications/drafts";
import { logError } from "@/lib/errorlog";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import { LEGAL_VERSION } from "@/lib/content/legal";

const { SB_URL, SB_ANON, SB_SERVICE } = process.env as Record<string, string>;
const ref = new URL(SB_URL).hostname.split(".")[0];
const noAuth = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin: SupabaseClient = createClient(SB_URL, SB_SERVICE, noAuth);
const sql = async <T = Record<string, unknown>>(query: string): Promise<T[]> => {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const text = await r.text();
    try { const j = JSON.parse(text); if (Array.isArray(j)) return j as T[]; throw new Error(text.slice(0, 300)); }
    catch (e) { if (attempt >= 4 || (e as Error).name !== "SyntaxError") throw e; await new Promise((res) => setTimeout(res, 1500 * attempt)); }
  }
};
const users: string[] = [];
async function makeUser(label: string) {
  const email = `p2-${label}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = c.data.user!.id; users.push(id);
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(SB_URL, SB_SERVICE, noAuth).auth.verifyOtp({ type: "magiclink", token_hash: gl.data.properties!.hashed_token });
  const client = createClient(SB_URL, SB_ANON, { ...noAuth, global: { headers: { Authorization: `Bearer ${v.data.session!.access_token}` } } });
  return { id, email, client };
}
type TUser = Awaited<ReturnType<typeof makeUser>>;
const picture = () => sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 120, g: 160, b: 210 } } }).jpeg().toBuffer();
const futureDate = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const DOCS = ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"];

async function makeDraft(user: TUser, tag: string, o: { days?: number; pkg?: "regular" | "express" } = {}) {
  const pkg = o.pkg ?? "regular";
  const trip = (await admin.from("trips").insert({ owner_id: user.id, package: pkg, arrival_airport_id: 1, arrival_date: futureDate(o.days ?? 12), arrival_time: "05:40", arrival_flight_no: "TG316", arrival_airline_id: 1, departure_date: futureDate((o.days ?? 12) + 10), departure_time: "09:00", departure_flight_no: "TG317", departure_airline_id: 1, purpose_id: 5, boarded_country_id: 1, next_city: "Bangkok", type_of_flight_id: 2 }).select("id").single()).data!;
  const t = await upsertTraveler(user.id, { given_name: "Test", surname: "Traveler", gender_id: 2, salutation_id: 2, date_of_birth: "1990-05-01", nationality_id: 1, passport_no: `T${Math.floor(100000 + Math.random() * 899999)}${tag}`, passport_issue_date: "2021-03-09", passport_expiry_date: "2031-03-08", passport_place_of_issue: "Delhi", email: user.email, phone: "912345678" });
  if (!t.ok) throw new Error(t.error);
  const app = await createDraftApplication(user.id, { tripId: trip.id, travelerId: t.id, pkg, form: { residency_id: 1, permanent_address: "Delhi", state: "Delhi", yearly_income_id: 2, occupation_id: 2, isd_code: "+91", mobile: "912345678", email: user.email, first_time_traveller: 1, stay: { place_of_stay_id: 1, name: "Test Hotel", city_id: 1, district_id: 101, sub_district_id: 1011, pin_code: "10330", street: "1 Test Road", reference: "BK123" } } });
  if (!app.ok) throw new Error(app.error);
  for (const k of DOCS) { const r = await saveApplicationDocument(user.id, app.id, k, new Uint8Array(await picture())); if (!r.ok) throw new Error(`${k}: ${r.error}`); }
  return { tripId: trip.id as string, appId: app.id };
}
async function realPayment(user: TUser, paymentId: string) {
  const { data: pay } = await admin.from("payments").select("amount_thb").eq("id", paymentId).single();
  const pi = await fetch("https://api.stripe.com/v1/payment_intents", { method: "POST", headers: { Authorization: "Bearer proxy-injected", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount: String(Math.round(Number(pay!.amount_thb) * 100)), currency: "thb", payment_method: "pm_card_visa", confirm: "true", "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never" }) }).then((r) => r.json());
  expect(pi.status, JSON.stringify(pi.error ?? {})).toBe("succeeded");
  const marked = await admin.rpc("mark_payment_paid", { p_id: paymentId, p_intent: pi.id });
  expect((marked.data as { receipt_no?: string })?.receipt_no).toMatch(/^RC-\d{2}-\d{6}$/);
  await afterPayment(paymentId);
}
async function payOrder(user: TUser, tripId: string) {
  const co = await startCheckout(user.id, user.email, tripId, "en"); if (!co.ok) throw new Error(`checkout: ${co.error} ${JSON.stringify(co.details)}`);
  await realPayment(user, co.paymentId); return co.paymentId;
}
const statusOf = async (id: string) => (await sql<{ status: string }>(`select status from public.applications where id='${id}'`))[0]?.status;

let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void> }; let mockBase = ""; let cbServer: Server; let mailServer: Server;
const mails: { to: string[]; subject: string; attachments?: { filename: string; content: string }[]; text: string }[] = [];
let masterWasEmpty = false, catalogueWasEmpty = false;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "proxy-injected";
  masterWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.master_data"))[0].n) === 0;
  catalogueWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.partner_packages"))[0].n) === 0;
  mailServer = createServer((req, res) => { const c: Buffer[] = []; req.on("data", (x) => c.push(x)); req.on("end", () => { if (req.headers.authorization === "Bearer test-resend-key") mails.push(JSON.parse(Buffer.concat(c).toString())); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"id":"x"}'); }); });
  await new Promise<void>((r) => mailServer.listen(0, "127.0.0.1", r));
  cbServer = createServer((req, res) => { const c: Buffer[] = []; req.on("data", (x) => c.push(x)); req.on("end", async () => { const [, first, ...rest] = (req.url ?? "/").split("?")[0].split("/"); try { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(await handlePartnerCallback(first as "insurance", "/" + rest.join("/"), JSON.parse(Buffer.concat(c).toString())))); } catch { res.writeHead(500); res.end("{}"); } }); });
  await new Promise<void>((r) => cbServer.listen(0, "127.0.0.1", r));
  const cb = `http://127.0.0.1:${(cbServer.address() as { port: number }).port}`;
  mock = createMockServer({ decisionDelayMs: 60, log: () => {}, callbacks: { insurance: `${cb}/insurance`, sim: `${cb}/sim`, vip: `${cb}/vip`, bhs: `${cb}/bhs` } });
  mockBase = `http://127.0.0.1:${await mock.listen(0)}`;
  Object.assign(process.env, { PARTNER_INSURANCE_URL: `${mockBase}/insurance/CIS`, PARTNER_SIM_URL: `${mockBase}/sim`, PARTNER_VIP_URL: `${mockBase}/vip`, PARTNER_BHS_URL: `${mockBase}/bhs`, INSURANCE_G_API_KEY: "g", INSURANCE_TOKEN: "t", PARTNER_SECRET: "mock-secret", PARTNER_PUBLIC_KEY: "mock-public",
    RESEND_API_KEY: "test-resend-key", RESEND_API_URL: `http://127.0.0.1:${(mailServer.address() as { port: number }).port}/emails` });
  if (masterWasEmpty) await syncFlatLists(new HttpImmigrationGateway({ baseUrl: `${mockBase}/immigration/th/v1`, token: "jwt", from: "thaipass" }));
  await syncPartnerPackages();
}, 300_000);

afterAll(async () => {
  const problems: string[] = [];
  await Promise.all(users.map(async (id) => {
    const { data } = await admin.from("documents").select("storage_path").eq("owner_id", id);
    if (data?.length) await admin.storage.from("documents").remove(data.map((d) => d.storage_path));
    const r = await admin.auth.admin.deleteUser(id); if (r.error) problems.push(`user ${id}: ${r.error.message}`);
  }));
  const clean = [masterWasEmpty ? "delete from public.master_data; delete from public.master_sync;" : "", catalogueWasEmpty ? "delete from public.partner_packages;" : "", "delete from public.rate_limits where key like 'test:%'; delete from public.error_log where route = 'TEST /live';"].join(" ").trim();
  await sql(clean).catch((e) => problems.push(String(e)));
  await mock?.close(); await new Promise((r) => cbServer?.close(r)); await new Promise((r) => mailServer?.close(r));
  if (problems.length) throw new Error(`cleanup incomplete: ${problems.join("; ")}`);
}, 300_000);

describe("small safeguards", () => {
  it("rate limit counts in the database: the call after the limit is refused, another key is not affected", async () => {
    const key = `test:${randomBytes(4).toString("hex")}`;
    expect([await rateLimit(key, 3, 60), await rateLimit(key, 3, 60), await rateLimit(key, 3, 60), await rateLimit(key, 3, 60)]).toEqual([true, true, true, false]);
    expect(await rateLimit(`${key}:other`, 3, 60)).toBe(true);
  });
  it("the error log keeps no personal data and only admins can read it", async () => {
    await logError({ route: "TEST /live", kind: "test", message: "failed for someone@example.com with passport 123456789 and token abcdefghijklmnopqrstuvwxyz0123" });
    const row = (await sql<{ message: string }>("select message from public.error_log where route = 'TEST /live' order by id desc limit 1"))[0];
    expect(row.message).not.toMatch(/someone@example|123456789|abcdefghijklmnop/); expect(row.message).toContain("[email]");
    const u = await makeUser("err"); expect((await u.client.from("error_log").select("id")).data).toEqual([]);
  });
  it("the signature picture must be a real small PNG", async () => {
    const png = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).png().toBuffer();
    expect(decodeSignature(`data:image/png;base64,${png.toString("base64")}`)).toBeInstanceOf(Uint8Array);
    expect(decodeSignature("data:image/png;base64,AAAA")).toBeNull(); expect(decodeSignature("data:text/html;base64,PGI+")).toBeNull(); expect(decodeSignature("javascript:alert(1)")).toBeNull();
  });
  it("a PDF receipt can be built", async () => {
    const pdf = await buildReceiptPdf({ brand: "ThaiPass e-VOA", receiptNo: "RC-26-000001", paidAt: new Date().toISOString(), lines: [{ label: "Thai visa fee · Anna Ériksson", amountThb: 2000 }, { label: "Service fee (regular)", amountThb: 600 }], totalThb: 2600, refunds: [], note: "This is a payment receipt, not a visa." });
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-"); expect(pdf.length).toBeGreaterThan(800);
  });
});

describe("consent, declaration, drafts", () => {
  it("records what was accepted and the signed declaration once, and keeps the signature encrypted", async () => {
    const u = await makeUser("consent"); const d = await makeDraft(u, "APR");
    const sig = new Uint8Array(await sharp({ create: { width: 300, height: 100, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer());
    expect(await recordConsent(u.id, d.tripId, { signerName: "Test Traveler", signature: sig, withPartners: false })).toEqual({ ok: true });
    expect(await recordConsent(u.id, d.tripId, { signerName: "Test Traveler", signature: sig, withPartners: false })).toEqual({ ok: true });      // again: no duplicates
    const cons = (await admin.from("consents").select("kind, version").eq("application_id", d.appId)).data!;
    expect(cons.map((c) => c.kind).sort()).toEqual(["immigration_share", "privacy", "terms"]); expect(cons.every((c) => c.version === LEGAL_VERSION)).toBe(true);
    const decl = (await admin.from("declarations").select("signer_name, signature_document_id").eq("application_id", d.appId).single()).data!;
    expect(decl.signer_name).toBe("Test Traveler"); expect(decl.signature_document_id).toBeTruthy();
    expect((await admin.from("documents").select("id").eq("application_id", d.appId).eq("kind", "signature").is("deleted_at", null)).data).toHaveLength(1);
    const o = await makeUser("consent-other");
    expect((await o.client.from("consents").select("id").eq("application_id", d.appId)).data).toEqual([]); expect((await u.client.from("consents").select("id").eq("application_id", d.appId)).data!.length).toBe(3);
    expect((await o.client.from("declarations").select("application_id")).data).toEqual([]);
  });
  it("the autosaved form comes back, is encrypted at rest, ignores unknown fields, and goes away", async () => {
    const u = await makeUser("draft"); const trip = (await admin.from("trips").insert({ owner_id: u.id, arrival_date: futureDate(12), package: "regular" }).select("id").single()).data!;
    expect(await saveDraft(u.id, trip.id, "new", { given_name: "Anna", passport_no: "L898902C3", evil: "x" })).toBe(true);
    expect(await loadDraft(u.id, trip.id, "new")).toEqual({ given_name: "Anna", passport_no: "L898902C3" });
    const raw = (await sql<{ data_enc: string }>(`select data_enc from public.form_drafts where trip_id='${trip.id}'`))[0].data_enc;
    expect(raw).not.toContain("Anna"); expect(raw).not.toContain("L898902C3");
    expect(await saveDraft(u.id, trip.id, "../../etc", { given_name: "x" })).toBe(false);
    await deleteDrafts(u.id, trip.id, ["new"]); expect(await loadDraft(u.id, trip.id, "new")).toBeNull();
  });
});

describe("upgrade, cancel and e-mail", () => {
  it("pays the difference to go from Regular to Express: fee, package and deadline change; a second upgrade is refused; the receipt is mailed with its PDF", async () => {
    const u = await makeUser("upg"); const d = await makeDraft(u, "SLOW");
    await payOrder(u, d.tripId);
    expect(await statusOf(d.appId)).toBe("pre_check");                                                       // waits for Immigration (not connected in this test)
    expect(mails.some((m) => m.to.includes(u.email) && m.attachments?.some((a) => a.filename.endsWith(".pdf") && Buffer.from(a.content, "base64").subarray(0, 4).toString() === "%PDF"))).toBe(true);
    const q = await upgradeQuote(d.appId, u.id); expect(q).toMatchObject({ ok: true, diffThb: 1900 });
    expect(await upgradeQuote(d.appId, (await makeUser("upg-other")).id)).toMatchObject({ ok: false, error: "err_not_found" });
    const co = await startUpgradeCheckout(u.id, u.email, d.appId, "en"); expect(co.ok, JSON.stringify(co)).toBe(true); if (!co.ok) return;
    const p = (await admin.from("payments").select("amount_thb, kind, upgrade_application_id, status").eq("id", co.paymentId).single()).data!;
    expect(p).toMatchObject({ kind: "upgrade", upgrade_application_id: d.appId, status: "pending" }); expect(Number(p.amount_thb)).toBe(1900);
    expect((await admin.from("applications").select("package").eq("id", d.appId).single()).data!.package).toBe("regular");     // nothing changes before the money is confirmed
    await realPayment(u, co.paymentId); await afterPayment(co.paymentId);                                    // twice: the same result
    const a = (await admin.from("applications").select("package, service_fee_thb, sla_due_at, upgraded_at").eq("id", d.appId).single()).data!;
    expect(a.package).toBe("express"); expect(a.service_fee_thb).toBe(2500); expect(a.upgraded_at).toBeTruthy();
    expect(Date.parse(a.sla_due_at!) - Date.now()).toBeLessThan(24 * 3600_000 + 60_000);
    expect(await upgradeQuote(d.appId, u.id)).toMatchObject({ ok: false, error: "err_upgrade_unavailable" });
    expect(await statusOf(d.appId)).toBe("pre_check");
  });

  it("an application with SIM/VIP extras cannot be upgraded to Express", async () => {
    const u = await makeUser("upg-sim"); const d = await makeDraft(u, "SLOW");
    const sim = (await offersFor("regular", 1)).find((o) => o.category === "sim")!;
    expect(await setAddons(u.id, d.appId, [{ category: "sim", packageCode: sim.package_code }])).toEqual({ ok: true });
    await payOrder(u, d.tripId);
    expect(await upgradeQuote(d.appId, u.id)).toMatchObject({ ok: false, error: "err_upgrade_addons" });
  });

  it("cancelling keeps the visa and service fee but gives back the unused extra", async () => {
    const u = await makeUser("cancel"); const d = await makeDraft(u, "SLOW");
    const esim = (await offersFor("regular", 1)).find((o) => o.category === "esim")!;
    expect(await setAddons(u.id, d.appId, [{ category: "esim", packageCode: esim.package_code }])).toEqual({ ok: true });
    const pid = await payOrder(u, d.tripId);
    expect(await cancelByTraveler((await makeUser("cancel-other")).id, d.appId)).toMatchObject({ ok: false });
    const r = await cancelByTraveler(u.id, d.appId); expect(r).toMatchObject({ ok: true, refundedThb: esim.price_thb });
    expect(await statusOf(d.appId)).toBe("cancelled");
    const p = (await admin.from("payments").select("amount_thb, refunded_thb, status").eq("id", pid).single()).data!;
    expect(Number(p.amount_thb) - Number(p.refunded_thb)).toBe(2600); expect(p.status).toBe("partially_refunded");
    expect(await cancelByTraveler(u.id, d.appId)).toMatchObject({ ok: false });                              // once only
    const again = await refundAddon((await admin.from("addon_orders").select("id").eq("application_id", d.appId).single()).data!.id, "again", null); expect(again.ok).toBe(false);
  });

  it("status notices go out by e-mail in the traveler's language, once per event", async () => {
    const u = await makeUser("mail"); await admin.from("profiles").update({ lang: "th" }).eq("id", u.id);
    const { notifyUser } = await import("@/lib/notify");
    const before = mails.length;
    await notifyUser({ userId: u.id, title: "ทดสอบ", body: "ข้อความทดสอบ", link: "/trips", kind: "application.approved", dedupeKey: "mailtest:1" });
    await notifyUser({ userId: u.id, title: "ทดสอบ", body: "ข้อความทดสอบ", link: "/trips", kind: "application.approved", dedupeKey: "mailtest:1" });      // same event again
    await notifyUser({ userId: u.id, title: "test", kind: "test" });                                                                                                   // test notices are not mailed
    const mine = mails.slice(before).filter((m) => m.to.includes(u.email));
    expect(mine).toHaveLength(1); expect(mine[0].text).toContain("ไม่ใช่ข้อความจากหน่วยงานรัฐ");
  });
});
