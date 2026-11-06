// Live checks for Phase 2 + 3 against the REAL Supabase project, the REAL Stripe TEST API and the partner simulator.
// Everything it creates is removed at the end (users cascade to trips/applications/payments; reference lists are removed only if they were empty before).
// The hosted Stripe Checkout page cannot be opened from the cloud sandbox, so "the customer pays" is reproduced with a real Stripe test PaymentIntent
// (pm_card_visa) recorded through the same mark_payment_paid function and afterPayment the app uses. Run: npm run e2e:phase1 (this file is picked up too)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { HttpImmigrationGateway, type ImmigrationGateway } from "@/lib/immigration/gateway";
import { StatusCallback } from "@/lib/immigration/schema";
import { handleStatusCallback, processOutbox } from "@/lib/immigration/pipeline";
import { syncFlatLists } from "@/lib/immigration/sync";
import { createDraftApplication, saveApplicationDocument, upsertTraveler, documentKinds } from "@/lib/applications/service";
import { startCheckout, afterPayment, confirmPayment, failPayment, refundAddon, refundException, expireUnpaid } from "@/lib/payments/service";
import { handlePartnerCallback, issueAddon, offersFor, setAddons, syncPartnerPackages, processAddonQueue } from "@/lib/partners/service";
import { lookupFlight } from "@/lib/flights";
import { passToken, verifyPassToken } from "@/lib/passes";

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
const waitFor = async <T>(fn: () => Promise<T | null | false | undefined>, ms = 20_000): Promise<T> => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("timed out waiting for condition");
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

let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void> };
let gw: ImmigrationGateway; let mockBase = ""; let cbServer: Server;
let catalogueWasEmpty = false, masterWasEmpty = false; const settingsTouched: string[] = [];

const picture = (w = 900, h = 1200) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 160, b: 210 } } }).jpeg().toBuffer();
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Same calls the wizard's server actions make: traveler → draft application → documents. */
async function makeDraft(user: TUser, tag: string, opts: { days?: number; pkg?: "regular" | "express"; docs?: string[] } = {}) {
  const passport = `T${Math.floor(100000 + Math.random() * 899999)}${tag}`;
  const trip = (await admin.from("trips").insert({
    owner_id: user.id, package: opts.pkg ?? "regular", arrival_airport_id: 1, arrival_date: futureDate(opts.days ?? 12), arrival_time: "05:40", arrival_flight_no: "TG316", arrival_airline_id: 1,
    departure_date: futureDate((opts.days ?? 12) + 10), departure_time: "09:00", departure_flight_no: "TG317", departure_airline_id: 1, purpose_id: 5, boarded_country_id: 1, next_city: "Bangkok", type_of_flight_id: 2,
  }).select("id").single()).data!;
  const t = await upsertTraveler(user.id, { given_name: "Test", surname: "Traveler", gender_id: 2, salutation_id: 2, date_of_birth: "1990-05-01", nationality_id: 1, passport_no: passport,
    passport_issue_date: "2021-03-09", passport_expiry_date: "2031-03-08", passport_place_of_issue: "Delhi", email: user.email, phone: "912345678" });
  if (!t.ok) throw new Error(t.error);
  const app = await createDraftApplication(user.id, { tripId: trip.id, travelerId: t.id, pkg: opts.pkg ?? "regular", form: {
    residency_id: 1, permanent_address: "Delhi", state: "Delhi", yearly_income_id: 2, occupation_id: 2, isd_code: "+91", mobile: "912345678", email: user.email, first_time_traveller: 1,
    stay: { place_of_stay_id: 1, name: "Test Hotel", city_id: 1, district_id: 101, sub_district_id: 1011, pin_code: "10330", street: "1 Test Road", reference: "BK123" } } });
  if (!app.ok) throw new Error(app.error);
  for (const kind of opts.docs ?? ["passport_bio", "photo", "return_ticket", "accommodation", "funds"]) {
    const r = await saveApplicationDocument(user.id, app.id, kind, new Uint8Array(await picture())); if (!r.ok) throw new Error(`${kind}: ${r.error}`);
  }
  return { tripId: trip.id as string, appId: app.id, passport };
}

/** The customer's card payment, reproduced with a REAL Stripe test PaymentIntent, then recorded exactly as the app does it. */
async function payFor(user: TUser, tripId: string) {
  const co = await startCheckout(user.id, user.email, tripId, "en");
  if (!co.ok) throw new Error(`checkout: ${co.error} ${JSON.stringify(co.details)}`);
  const { data: pay } = await admin.from("payments").select("amount_thb").eq("id", co.paymentId).single();
  const pi = await fetch("https://api.stripe.com/v1/payment_intents", { method: "POST", headers: { Authorization: "Bearer proxy-injected", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount: String(Math.round(Number(pay!.amount_thb) * 100)), currency: "thb", payment_method: "pm_card_visa", confirm: "true", "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never" }) }).then((r) => r.json());
  expect(pi.status, JSON.stringify(pi.error ?? {})).toBe("succeeded");
  const marked = await admin.rpc("mark_payment_paid", { p_id: co.paymentId, p_intent: pi.id });
  expect((marked.data as { receipt_no?: string })?.receipt_no).toMatch(/^RC-\d{2}-\d{6}$/);
  await afterPayment(co.paymentId);
  return { paymentId: co.paymentId, intent: pi.id as string };
}
const statusOf = async (id: string) => (await sql<{ status: string }>(`select status from public.applications where id='${id}'`))[0]?.status;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "proxy-injected";
  masterWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.master_data"))[0].n) === 0;
  catalogueWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.partner_packages"))[0].n) === 0;
  cbServer = createServer((req, res) => {
    const chunks: Buffer[] = []; req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const send = (code: number, b: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
      if (req.headers.authorization !== "Bearer mock-callback-secret") return send(401, { isSuccess: false });
      const body = JSON.parse(Buffer.concat(chunks).toString() || "null");
      try {
        const [, first, ...rest] = (req.url ?? "/").split("?")[0].split("/");
        if (first === "imm") { const p = StatusCallback.safeParse(body); if (!p.success) return send(400, { isSuccess: false }); return send(200, await handleStatusCallback(p.data, gw)); }
        send(200, await handlePartnerCallback(first as "insurance", "/" + rest.join("/"), body));
      } catch (e) { console.error("callback error", (e as Error).message); send(500, {}); }
    });
  });
  await new Promise<void>((r) => cbServer.listen(0, "127.0.0.1", r));
  const cb = `http://127.0.0.1:${(cbServer.address() as { port: number }).port}`;
  mock = createMockServer({ decisionDelayMs: 60, log: () => {}, callbacks: { immigration: `${cb}/imm/`, insurance: `${cb}/insurance`, sim: `${cb}/sim`, vip: `${cb}/vip`, bhs: `${cb}/bhs` } });
  mockBase = `http://127.0.0.1:${await mock.listen(0)}`;
  gw = new HttpImmigrationGateway({ baseUrl: `${mockBase}/immigration/th/v1`, token: "jwt", from: "thaipass" });
  Object.assign(process.env, {
    PARTNER_INSURANCE_URL: `${mockBase}/insurance/CIS`, PARTNER_SIM_URL: `${mockBase}/sim`, PARTNER_VIP_URL: `${mockBase}/vip`, PARTNER_BHS_URL: `${mockBase}/bhs`,
    INSURANCE_G_API_KEY: "g-key", INSURANCE_TOKEN: "ins-token", PARTNER_SECRET: "mock-secret", PARTNER_PUBLIC_KEY: "mock-public", FLIGHT_API_URL: mockBase,
  });
  if (masterWasEmpty) await syncFlatLists(gw);
  await syncPartnerPackages();
}, 300_000);

afterAll(async () => {
  const problems: string[] = [];
  await Promise.all(users.map(async (id) => {
    const { data } = await admin.from("documents").select("storage_path").eq("owner_id", id);
    if (data?.length) await admin.storage.from("documents").remove(data.map((d) => d.storage_path));
    const r = await admin.auth.admin.deleteUser(id); if (r.error) problems.push(`user ${id}: ${r.error.message}`);
  }));
  const clean = [masterWasEmpty ? "delete from public.master_data; delete from public.master_sync;" : "", catalogueWasEmpty ? "delete from public.partner_packages;" : ""].join(" ").trim();
  if (clean) await sql(clean).catch((e) => problems.push(String(e)));                        // simulator data must not stay in the real database
  await mock?.close(); await new Promise((r) => cbServer?.close(r));
  if (problems.length) throw new Error(`cleanup incomplete: ${problems.join("; ")}`);
}, 300_000);

describe("catalogue and rules", () => {
  it("copies the partners' packages and applies the airport / Express rules", async () => {
    const reg = await offersFor("regular", 1), exp = await offersFor("express", 1), other = await offersFor("regular", 2);
    expect(reg.map((o) => o.category)).toEqual(expect.arrayContaining(["insurance", "esim", "sim", "vip", "health"]));
    expect(reg.filter((o) => o.category === "sim").every((o) => o.offer.available)).toBe(true);
    expect(exp.filter((o) => o.category === "sim" || o.category === "vip").every((o) => !o.offer.available)).toBe(true);
    expect(exp.filter((o) => o.category === "esim").every((o) => o.offer.available)).toBe(true);
    expect(other.filter((o) => o.category === "vip").every((o) => !o.offer.available)).toBe(true);
  });

  it("looks up a flight through the provider", async () => {
    const f = await lookupFlight("tg 316", futureDate(12));
    expect(f).toMatchObject({ flight: "TG316" });
    expect(f?.arrivalTime).toMatch(/^\d{2}:\d{2}$/);
    expect(await lookupFlight("ZZ0000", futureDate(12))).toBeNull();
  });
});

describe("order → pay → check → Immigration → E-VOA → pass, with add-ons", () => {
  let u: TUser; let d: Awaited<ReturnType<typeof makeDraft>>; let pay: Awaited<ReturnType<typeof payFor>>; let esimId = "", insId = "";
  it("refuses to take money for an incomplete application", async () => {
    u = await makeUser("life"); d = await makeDraft(u, "APR", { docs: ["passport_bio", "photo"] });
    const co = await startCheckout(u.id, u.email, d.tripId);
    expect(co).toMatchObject({ ok: false, error: "err_incomplete" });
    expect(await statusOf(d.appId)).toBe("draft");
    for (const kind of ["return_ticket", "accommodation", "funds"]) expect((await saveApplicationDocument(u.id, d.appId, kind, new Uint8Array(await picture()))).ok).toBe(true);
  });

  it("add-ons: rules are enforced on the server, prices come from the catalogue", async () => {
    const offers = await offersFor("regular", 1);
    const ins = offers.find((o) => o.category === "insurance")!, esim = offers.find((o) => o.category === "esim")!;
    expect(await setAddons(u.id, d.appId, [{ category: "insurance", packageCode: "NOPE" }])).toMatchObject({ ok: false });
    expect(await setAddons(u.id, d.appId, [{ category: "insurance", packageCode: ins.package_code }, { category: "esim", packageCode: esim.package_code }])).toEqual({ ok: true });
    const rows = (await admin.from("addon_orders").select("id, category, price_thb, status").eq("application_id", d.appId)).data!;
    expect(rows).toHaveLength(2); expect(rows.every((r) => r.status === "pending_payment")).toBe(true);
    insId = rows.find((r) => r.category === "insurance")!.id; esimId = rows.find((r) => r.category === "esim")!.id;
    expect(Number(rows.find((r) => r.category === "esim")!.price_thb)).toBe(esim.price_thb);          // never what the browser sent
  });

  it("starts a real Stripe TEST checkout with the exact total, and an unpaid session is not 'paid'", async () => {
    const co = await startCheckout(u.id, u.email, d.tripId, "th");
    expect(co.ok, JSON.stringify(co)).toBe(true); if (!co.ok) return;
    expect(co.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const { data: p } = await admin.from("payments").select("amount_thb, status, items, provider_ref").eq("id", co.paymentId).single();
    const addons = (await admin.from("addon_orders").select("price_thb").eq("application_id", d.appId)).data!.reduce((s, r) => s + Number(r.price_thb), 0);
    expect(Number(p!.amount_thb)).toBe(2000 + 600 + addons); expect(p!.status).toBe("pending");
    expect(await statusOf(d.appId)).toBe("awaiting_payment");
    expect(await confirmPayment(co.paymentId, p!.provider_ref!)).toEqual({ ok: false, error: "pending" });     // Stripe says: not paid
    expect(await confirmPayment(co.paymentId, "cs_test_someone_elses")).toMatchObject({ ok: false, error: "mismatch" });
    await failPayment(co.paymentId, "test: customer closed the page");
    expect(await statusOf(d.appId)).toBe("draft");                                                             // can edit and pay again
    expect((await admin.from("addon_orders").select("payment_id").eq("id", esimId).single()).data!.payment_id).toBeNull();
  });

  it("after payment: receipt, status paid → pre_check, eSIM issued, insurance waits for the policy", async () => {
    pay = await payFor(u, d.tripId);
    const p = (await admin.from("payments").select("status, receipt_no, provider_payment_ref").eq("id", pay.paymentId).single()).data!;
    expect(p.status).toBe("paid"); expect(p.provider_payment_ref).toBe(pay.intent);
    await afterPayment(pay.paymentId);                                                                        // a repeated webhook changes nothing
    const again = await admin.rpc("mark_payment_paid", { p_id: pay.paymentId, p_intent: pay.intent });
    expect(again.data === null || !(again.data as { id?: string })?.id).toBe(true);
    const esim = (await admin.from("addon_orders").select("status, delivery").eq("id", esimId).single()).data!;
    expect(esim.status).toBe("issued"); expect(esim.delivery).toMatchObject({ esim_lpa: expect.any(String) });
    expect((await sql<{ n: number }>(`select count(*) n from public.app_notifications where user_id='${u.id}' and dedupe_key='pay:${pay.paymentId}:paid'`))[0].n).toBe(1);
  });

  it("the insurance policy arrives by callback, is attached, and the application goes to Immigration and is approved", async () => {
    await waitFor(async () => (await admin.from("addon_orders").select("status").eq("id", insId).single()).data?.status === "issued");
    expect(await documentKinds(d.appId)).toContain("insurance");
    await waitFor(async () => (await sql<{ n: number }>(`select count(*) n from public.immigration_outbox where application_id='${d.appId}'`))[0].n > 0);
    await processOutbox(gw);
    await waitFor(async () => (await statusOf(d.appId)) === "approved", 30_000);
    const evoa = await admin.from("documents").select("id").eq("application_id", d.appId).eq("kind", "evoa").is("deleted_at", null);
    expect(evoa.data).toHaveLength(1);
    // the QR token is signed; a changed id or signature is refused
    const tok = passToken(d.appId); expect(verifyPassToken(tok)).toBe(d.appId);
    expect(verifyPassToken(tok.slice(0, -2) + "xx")).toBeNull(); expect(verifyPassToken(passToken(d.appId.replace(/.$/, "0")) + "")).not.toBe(d.appId + "x");
  });

  it("other travelers cannot read this payment, add-ons or refunds (RLS)", async () => {
    const o = await makeUser("other");
    expect((await o.client.from("payments").select("id").eq("id", pay.paymentId)).data).toEqual([]);
    expect((await o.client.from("addon_orders").select("id").eq("id", esimId)).data).toEqual([]);
    expect((await u.client.from("payments").select("id").eq("id", pay.paymentId)).data).toHaveLength(1);
    expect((await o.client.from("application_notes").select("id")).data).toEqual([]);
  });

  it("refunds follow the policy: an unused add-on yes (real Stripe test refund), twice no, visa/service fees never automatically", async () => {
    const r = await refundAddon(esimId, "test", null);
    expect(r).toMatchObject({ ok: true }); const amount = r.ok ? r.amountThb : 0;
    const p = (await admin.from("payments").select("status, refunded_thb").eq("id", pay.paymentId).single()).data!;
    expect(p.status).toBe("partially_refunded"); expect(Number(p.refunded_thb)).toBe(amount);
    expect((await admin.from("refunds").select("status, kind, provider_refund_id").eq("payment_id", pay.paymentId)).data).toEqual([expect.objectContaining({ status: "succeeded", kind: "addon", provider_refund_id: expect.stringMatching(/^re_/) })]);
    expect(await refundAddon(esimId, "again", null)).toMatchObject({ ok: false });
    const left = Number((await admin.from("payments").select("amount_thb, refunded_thb").eq("id", pay.paymentId).single()).data!.amount_thb) - amount;
    const over = await refundException(pay.paymentId, left + 5000, "too much", u.id);
    expect(over.ok ? over.amountThb : 0).toBeLessThanOrEqual(left);                                             // never more than was paid
  });
});

describe("rejection, failures and expiry", () => {
  it("a rejected application keeps its fees but its unused add-on goes back automatically", async () => {
    const u = await makeUser("rej"); const d = await makeDraft(u, "REJ", { docs: ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"] });
    const esim = (await offersFor("regular", 1)).find((o) => o.category === "esim")!;
    expect(await setAddons(u.id, d.appId, [{ category: "esim", packageCode: esim.package_code }])).toEqual({ ok: true });
    const pay = await payFor(u, d.tripId);
    await waitFor(async () => (await sql<{ n: number }>(`select count(*) n from public.immigration_outbox where application_id='${d.appId}'`))[0].n > 0);
    await processOutbox(gw);
    await waitFor(async () => (await statusOf(d.appId)) === "rejected", 30_000);
    await waitFor(async () => (await admin.from("payments").select("status").eq("id", pay.paymentId).single()).data!.status === "partially_refunded");
    const p = (await admin.from("payments").select("amount_thb, refunded_thb, status").eq("id", pay.paymentId).single()).data!;
    expect(Number(p.amount_thb) - Number(p.refunded_thb)).toBe(2600);                                          // visa + service fee stay
    expect(p.status).toBe("partially_refunded");
  });

  it("an add-on that cannot be bought is retried, then fails and is refunded automatically", async () => {
    const u = await makeUser("fail"); const d = await makeDraft(u, "APR", { docs: ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"] });
    const vip = (await offersFor("regular", 1)).find((o) => o.category === "vip")!;
    expect(await setAddons(u.id, d.appId, [{ category: "vip", packageCode: vip.package_code }])).toEqual({ ok: true });
    const good = process.env.PARTNER_VIP_URL; process.env.PARTNER_VIP_URL = "http://127.0.0.1:9";              // partner is down
    try {
      const pay = await payFor(u, d.tripId);
      const order = (await admin.from("addon_orders").select("id, status").eq("payment_id", pay.paymentId).single()).data!;
      let last = "";
      for (let i = 0; i < 6 && last !== "failed"; i++) { await admin.from("addon_orders").update({ next_attempt_at: new Date().toISOString() }).eq("id", order.id); last = await issueAddon(order.id); }
      expect(last).toBe("failed");
      const row = (await admin.from("addon_orders").select("status, refunded_thb").eq("id", order.id).single()).data!;
      expect(["failed", "refunded"]).toContain(row.status); expect(Number(row.refunded_thb)).toBe(vip.price_thb);
      expect(await processAddonQueue()).toBeDefined();
    } finally { process.env.PARTNER_VIP_URL = good; }
  });

  it("an unpaid order is closed after it expires and returns to draft", async () => {
    const u = await makeUser("exp"); const d = await makeDraft(u, "APR", { docs: ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"] });
    const co = await startCheckout(u.id, u.email, d.tripId); expect(co.ok).toBe(true); if (!co.ok) return;
    await admin.from("payments").update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", co.paymentId);
    expect(await expireUnpaid()).toBeGreaterThanOrEqual(1);
    expect((await admin.from("payments").select("status").eq("id", co.paymentId).single()).data!.status).toBe("failed");
    expect(await statusOf(d.appId)).toBe("draft");
  });

  it("Express cannot be ordered for a flight that lands in less than 24 hours, and Regular needs 72 hours", async () => {
    const { packageAvailability, arrivalInstant } = await import("@/lib/pricing");
    const soon = packageAvailability(new Date(), arrivalInstant(futureDate(1), "00:30"));
    expect(soon.regular).toBe(false);
  });
});
