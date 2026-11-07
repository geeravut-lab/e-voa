// Live checks for the "phase 5" features against the REAL Supabase project: e-mail notices, PDPA export/erasure, discount codes, re-apply, FAQ/news content, reconciliation.
// Everything created is removed at the end.
import { afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { notifyUser } from "@/lib/notify";
import { eraseAccount, erasureBlockers, exportMyData } from "@/lib/privacy/service";
import { failPayment, startCheckout } from "@/lib/payments/service";
import { quoteForTrip } from "@/lib/discounts/service";
import { reconcileDay, type StripeSide } from "@/lib/reconcile/service";
import { attentionItems } from "@/lib/admin-attention";
import { loadFaq, loadNews, pinnedNews } from "@/lib/content/server";
import { FAQ } from "@/lib/content/faq";
import { createClient } from "@supabase/supabase-js";
import { SB_ANON, SB_URL, admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

// the status guard only allows real transitions; these tests need states without whole journeys, so they skip the guard for their own rows
const setStatus = (id: string, status: string) => sql(`set session_replication_role = replica; update public.applications set status = '${status}' where id = '${id}'`);

const cleanups: string[] = [];
afterAll(async () => {
  const problems = await cleanupUsers();
  for (const q of cleanups) await sql(q).catch((e) => problems.push(String(e)));
  if (problems.length) throw new Error(`cleanup incomplete: ${problems.join("; ")}`);
}, 300_000);

describe("e-mail notices", () => {
  it("mails a notice with a way to switch off, respects the person's choice, and records only counts", async () => {
    const mails: { to: string[]; subject: string; text: string; headers?: Record<string, string> }[] = []; let status = 200;
    const server: Server = createServer((req, res) => { const c: Buffer[] = []; req.on("data", (x) => c.push(x)); req.on("end", () => { if (status === 200) mails.push(JSON.parse(Buffer.concat(c).toString())); res.writeHead(status, { "content-type": "application/json" }); res.end("{}"); }); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    Object.assign(process.env, { RESEND_API_KEY: "test-key", RESEND_API_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}/emails` });
    cleanups.push("delete from public.mail_log where kind = 'phase5'");
    try {
      const u = await makeUser("mail");
      expect(await notifyUser({ userId: u.id, title: "Your application was approved", body: "Reference EV-26-000001", link: "/trips", kind: "phase5" })).toBe(true);
      expect(mails).toHaveLength(1); expect(mails[0].to).toEqual([u.email]); expect(mails[0].subject).toContain("Your application was approved");
      expect(mails[0].text).toContain("/account/notifications"); expect(mails[0].headers?.["List-Unsubscribe"]).toMatch(/\/account\/notifications>$/);
      // the person switches e-mail notices off: the in-app notice is still made, no mail goes out
      await sql(`update public.profiles set email_notices = false where id = '${u.id}'`);
      expect(await notifyUser({ userId: u.id, title: "Second notice", kind: "phase5" })).toBe(true); expect(mails).toHaveLength(1);
      expect((await admin.from("app_notifications").select("id").eq("user_id", u.id)).data).toHaveLength(2);
      // the provider fails: the notice is kept, the failure is counted (code only)
      await sql(`update public.profiles set email_notices = true where id = '${u.id}'`); status = 500;
      expect(await notifyUser({ userId: u.id, title: "Third notice", kind: "phase5" })).toBe(true);
      const log = await sql<{ ok: boolean; code: number | null }>("select ok, code from public.mail_log where kind = 'phase5' order by id");
      expect(log).toEqual([{ ok: true, code: 200 }, { ok: false, code: 500 }]);
      expect(JSON.stringify(log)).not.toContain("@");                                                    // no address, no content in the log
    } finally { delete process.env.RESEND_API_KEY; delete process.env.RESEND_API_URL; await new Promise((r) => server.close(r)); }
  });
});

describe("PDPA: download and erase", () => {
  it("exports everything about the person (passport number readable), refuses while an application is in progress, then erases personal data but keeps the money records", async () => {
    const u = await makeUser("pdpa"), d = await makeDraft(u, "APR");
    const [{ passport_no }] = await sql<{ passport_no: string | null }>(`select passport_last4 as passport_no from public.travelers where id = '${d.travelerId}'`); expect(passport_no).toBeTruthy();
    const rnd = Math.random().toString(36).slice(2, 8);
    await sql(`insert into public.payments (owner_id, amount_thb, provider, provider_ref, status, receipt_no, items) values ('${u.id}', 2600, 'stripe', 'phase5-${rnd}', 'paid', 'P5-${rnd}', '[]'::jsonb)`);
    await notifyUser({ userId: u.id, title: "hello", kind: "phase5", mail: false });
    // 1) the export
    const out = await exportMyData(u.id, u.email) as { account: { email: string }; travelers: { given_name: string; passport_no: string | null }[]; applications: { id: string; form: unknown }[]; payments: { receipt_no: string }[]; notifications: unknown[]; documents: unknown[] };
    expect(out.account.email).toBe(u.email); expect(out.travelers[0].given_name).toBe("Test"); expect(out.travelers[0].passport_no).toMatch(/^T\d{6}/); expect(out.applications).toHaveLength(1);
    expect(out.payments[0].receipt_no).toBe(`P5-${rnd}`); expect(out.notifications).toHaveLength(1); expect(out.documents.length).toBeGreaterThan(0);
    expect(JSON.stringify(out)).not.toMatch(/passport_no_enc|passport_no_hash|storage_path/);                         // internal columns never leave
    // 2) blocked while the application is being processed; blocked for staff
    await setStatus(d.appId, "submitted");
    expect(await erasureBlockers(u.id)).toContain("err_erase_in_progress"); expect(await eraseAccount(u.id)).toEqual({ ok: false, error: "err_erase_in_progress" });
    const staff = await makeUser("pdpa-staff", { admin: true }); expect(await erasureBlockers(staff.id)).toContain("err_erase_admin");
    // 3) erase once it is decided
    await setStatus(d.appId, "approved");
    const files = (await sql<{ storage_path: string }>(`select storage_path from public.documents where owner_id = '${u.id}'`)).map((r) => r.storage_path); expect(files.length).toBeGreaterThan(0);
    expect(await erasureBlockers(u.id)).toEqual([]); expect(await eraseAccount(u.id)).toEqual({ ok: true });
    const one = async (q: string) => (await sql<Record<string, unknown>>(q))[0];
    expect(await one(`select count(*)::int n from public.documents where owner_id = '${u.id}'`)).toEqual({ n: 0 });
    for (const path of files) expect((await admin.storage.from("documents").download(path)).error).not.toBeNull();       // the files are gone from storage too
    expect(await one(`select given_name, surname, passport_no_enc, passport_last4, date_of_birth, email, phone from public.travelers where id = '${d.travelerId}'`)).toEqual({ given_name: "Deleted", surname: "traveler", passport_no_enc: null, passport_last4: null, date_of_birth: null, email: null, phone: null });
    expect(await one(`select form from public.applications where id = '${d.appId}'`)).toEqual({ form: {} });                  // the row stays, the personal answers do not
    expect(await one(`select display_name, email from public.profiles where id = '${u.id}'`)).toEqual({ display_name: null, email: null });
    expect(await one(`select count(*)::int n from public.app_notifications where user_id = '${u.id}'`)).toEqual({ n: 0 });
    expect(await one(`select receipt_no from public.payments where owner_id = '${u.id}'`)).toEqual({ receipt_no: `P5-${rnd}` });  // kept for accounting
    const au = await admin.auth.admin.getUserById(u.id); expect(au.data.user?.email).toBe(`erased-${u.id}@erased.invalid`); expect(au.data.user?.banned_until).toBeTruthy();
    const bad = await createClient(SB_URL, SB_ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email: `erased-${u.id}@erased.invalid`, password: "anything" }); expect(bad.error).not.toBeNull();   // the closed sign-in cannot be used
    await sql(`delete from public.payments where owner_id = '${u.id}'`);
  });
});

describe("discount codes at checkout (Stripe TEST API)", () => {
  it("takes a code off the service fee only, keeps the total consistent with the lines, enforces the limits, and gives a use back when the payment is cancelled", async () => {
    process.env.STRIPE_SECRET_KEY = "proxy-injected";                                                                                  // the sandbox proxy adds the real test key to Stripe calls
    const tag = `P5-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    cleanups.push(`delete from public.discount_codes where code like 'P5-%'`);
    await sql(`insert into public.discount_codes (code, kind, value, max_uses, per_user) values ('${tag}', 'percent', 10, 1, 1), ('${tag}-OFF', 'fixed', 100, null, 1), ('${tag}-OLD', 'fixed', 100, null, 1)`);
    await sql(`update public.discount_codes set active = false where code = '${tag}-OFF'`); await sql(`update public.discount_codes set valid_to = now() - interval '1 day' where code = '${tag}-OLD'`);
    const a = await makeUser("disc-a"), b = await makeUser("disc-b"), da = await makeDraft(a, "APR"), db = await makeDraft(b, "APR");
    const pay = async (id: string) => (await sql<{ amount_thb: number; discount_thb: number; items: { kind: string; amountThb: number }[]; status: string }>(`select amount_thb::int, discount_thb, items, status from public.payments where id = '${id}'`))[0];
    // the preview and the checkout agree
    const q = await quoteForTrip(a.id, da.tripId, tag.toLowerCase()); expect(q.ok).toBe(true); if (!q.ok) return;
    const co = await startCheckout(a.id, a.email, da.tripId, "en", ` ${tag.toLowerCase()} `); expect(co.ok).toBe(true); if (!co.ok) return;
    const p1 = await pay(co.paymentId), svc = p1.items.find((i) => i.kind === "service_fee")!, visa = p1.items.find((i) => i.kind === "visa_fee")!;
    expect(p1.discount_thb).toBe(q.discountThb); expect(p1.amount_thb).toBe(q.totalThb); expect(p1.discount_thb).toBe(Math.floor((svc.amountThb + p1.discount_thb) * 10 / 100));
    expect(visa.amountThb).toBe(2000);                                                                                                    // the government fee is untouched
    expect(p1.items.reduce((t, i) => t + i.amountThb, 0)).toBe(p1.amount_thb);                                                            // lines add up to what Stripe charges
    expect((await sql<{ n: number }>(`select count(*)::int n from public.discount_redemptions where payment_id = '${co.paymentId}'`))[0].n).toBe(1);
    // the only use is taken: someone else is refused, a bad or switched-off or out-of-date code is refused
    expect(await startCheckout(b.id, b.email, db.tripId, "en", tag)).toEqual({ ok: false, error: "err_discount_used_up" });
    for (const [code, err] of [["NOPE-NOPE", "err_discount_invalid"], [`${tag}-OFF`, "err_discount_invalid"], [`${tag}-OLD`, "err_discount_expired"], ["a", "err_discount_invalid"]] as const) expect(await startCheckout(b.id, b.email, db.tripId, "en", code), code).toEqual({ ok: false, error: err });
    expect((await sql<{ n: number }>(`select count(*)::int n from public.payments where owner_id = '${b.id}'`))[0].n).toBe(0);           // a refused code never leaves a payment behind
    // the same person starting again replaces the first payment: still one use, not two
    const again = await startCheckout(a.id, a.email, da.tripId, "en", tag); expect(again.ok).toBe(true); if (!again.ok) return;
    expect((await pay(co.paymentId)).status).toBe("failed"); expect((await sql<{ n: number }>(`select count(*)::int n from public.discount_redemptions where code_id = (select id from public.discount_codes where code = '${tag}')`))[0].n).toBe(1);
    // the payment is cancelled: the use goes back and the other person can have it
    await failPayment(again.paymentId, "test");
    expect((await sql<{ n: number }>(`select count(*)::int n from public.discount_redemptions where code_id = (select id from public.discount_codes where code = '${tag}')`))[0].n).toBe(0);
    const cb = await startCheckout(b.id, b.email, db.tripId, "en", tag); expect(cb.ok).toBe(true);
    // without a code nothing changes
    if (cb.ok) await failPayment(cb.paymentId, "test");
    const plain = await startCheckout(a.id, a.email, da.tripId, "en"); expect(plain.ok).toBe(true); if (plain.ok) { const pp = await pay(plain.paymentId); expect(pp.discount_thb).toBe(0); expect(pp.amount_thb).toBe(p1.amount_thb + p1.discount_thb); await failPayment(plain.paymentId, "test"); }
  });
});

describe("daily reconciliation", () => {
  it("compares our paid payments with Stripe's records for a Thai day, stores the result, and asks for attention until it is reviewed", async () => {
    const day = "2024-02-02", rnd = Math.random().toString(36).slice(2, 8), at = (h: number) => `2024-02-02T${String(h - 7).padStart(2, "0")}:00:00Z`;       // Thai hour h on that day
    cleanups.push(`delete from public.reconciliation_reports where day = '${day}'`);
    const u = await makeUser("recon");
    const row = (pi: string, thb: number, receipt: string, h = 10) => sql(`insert into public.payments (owner_id, amount_thb, provider, provider_ref, provider_payment_ref, status, paid_at, receipt_no, items) values ('${u.id}', ${thb}, 'stripe', 'cs_p5_${receipt}', '${pi}', 'paid', '${at(h)}', '${receipt}', '[]'::jsonb)`);
    await row(`pi_a_${rnd}`, 2600, `P5A-${rnd}`); await row(`pi_c_${rnd}`, 900, `P5C-${rnd}`); await row(`pi_d_${rnd}`, 1200, `P5D-${rnd}`);
    const sec = (h: number) => Math.floor(Date.parse(at(h)) / 1000) + 60;
    // Stripe side (the account is shared with other apps: payments that are not ours must be ignored). Our payments are recognised by metadata.payment_id.
    const [{ id: payA }] = await sql<{ id: string }>(`select id from public.payments where receipt_no = 'P5A-${rnd}'`), [{ id: payD }] = await sql<{ id: string }>(`select id from public.payments where receipt_no = 'P5D-${rnd}'`);
    const [{ id: payB }] = await sql<{ id: string }>(`insert into public.payments (owner_id, amount_thb, provider, provider_ref, status, items) values ('${u.id}', 700, 'stripe', 'cs_p5_B${rnd}', 'pending', '[]'::jsonb) returning id`);        // ours, but never marked paid
    const intent = (pi: string, satang: number, h: number, meta: Record<string, string>, currency = "thb") => ({ id: pi, amount_received: satang, currency, created: sec(h) - 600, status: "succeeded", metadata: meta, latest_charge: { created: sec(h), paid: true } });
    const stripe: StripeSide = {
      intents: async () => [intent(`pi_a_${rnd}`, 260000, 10, { payment_id: payA }), intent(`pi_b_${rnd}`, 70000, 11, { payment_id: payB }), intent(`pi_d_${rnd}`, 100000, 10, { payment_id: payD }),
        intent("pi_other_1", 299900, 10, {}), intent("pi_other_2", 328900, 12, { payment_id: "not-a-uuid" }), intent("pi_other_3", 460000, 12, { payment_id: "11111111-1111-4111-8111-111111111111" }), intent("pi_usd", 5000, 10, { payment_id: payA }, "usd")],
      refunds: async () => [{ id: "re_other", payment_intent: "pi_other_1", amount: 39900, currency: "thb", created: sec(11), status: "succeeded" }],
      hasPi: async () => false, hasRefund: async () => false,
    };
    const r = await reconcileDay(day, stripe); expect(r.status).toBe("issues"); if (!r.report) return;
    const kinds = r.report.issues.map((x) => `${x.kind}:${x.ref}`).sort();
    expect(kinds).toEqual([`amount_mismatch:P5D-${rnd}`, `ours_only:P5C-${rnd}`, `stripe_only:pi_b_${rnd}`].sort());
    expect(r.report.stripeCount).toBe(3);                                                                                                           // 2,600 + 700 + 1,000 only: the other app's 299,900 / 328,900 / 460,000 are not counted                // A matches; B is paid in Stripe but not in our records; C only ours; D differs; payments of OTHER apps in the shared Stripe account (no/odd/unknown payment_id, or another currency) and their refunds are ignored
    const saved = (await sql<{ status: string; stripe_gross_thb: number; reviewed_at: string | null }>(`select status, stripe_gross_thb, reviewed_at from public.reconciliation_reports where day = '${day}'`))[0];
    expect(saved.status).toBe("issues"); expect(saved.stripe_gross_thb).toBeGreaterThanOrEqual(4300);
    expect((await attentionItems()).find((i) => i.key === "recon_issues")?.count).toBeGreaterThanOrEqual(1);
    // when Stripe confirms the payment exists (just outside the day), it is not reported
    const again = await reconcileDay(day, { ...stripe, hasPi: async (id) => id === `pi_c_${rnd}` }); expect(again.report?.issues.map((x) => x.kind)).not.toContain("ours_only");
    await sql(`update public.reconciliation_reports set reviewed_at = now() where day = '${day}'`);
    expect((await attentionItems()).find((i) => i.key === "recon_issues")?.count ?? 0).toBe(0);                                                   // reviewed: it stops asking
    // Stripe unreachable: the day is recorded as an error, not as "all good"
    const bad = await reconcileDay(day, { ...stripe, intents: async () => { throw new Error("Stripe is down"); } }); expect(bad.status).toBe("error");
    expect((await sql<{ status: string; error: string }>(`select status, error from public.reconciliation_reports where day = '${day}'`))[0]).toEqual({ status: "error", error: "Stripe is down" });
  });
});

describe("FAQ and news from the back office", () => {
  it("shows published items in the reader's language (English as the fallback), in order, and falls back to the built-in FAQ when none is published", async () => {
    cleanups.push(`delete from public.content_items where title->>'en' like 'P5 %'`);
    const before = await loadFaq("en"); expect(before.length).toBe(FAQ.en.length);                                                                   // nothing written yet: the built-in questions
    const ins = (kind: string, title: object, body: object, o = "") => sql(`insert into public.content_items (kind, title, body, ${o ? o.split("|")[0] : "published"}) values ('${kind}', '${JSON.stringify(title)}'::jsonb, '${JSON.stringify(body)}'::jsonb, ${o ? o.split("|")[1] : "true"})`);
    await ins("faq", { en: "P5 Second", th: "P5 ที่สอง" }, { en: "Answer two", th: "ตอบสอง" }, "published, sort|true, 20"); await ins("faq", { en: "P5 First" }, { en: "Answer one" }, "published, sort|true, 10"); await ins("faq", { en: "P5 Hidden" }, { en: "x" }, "published|false");
    expect((await loadFaq("en")).map((f) => f.q)).toEqual(["P5 First", "P5 Second"]);                                                                // only the published ones, by order
    expect((await loadFaq("th")).map((f) => f.q)).toEqual(["P5 First", "P5 ที่สอง"]);                                                              // Thai where written, English where not
    expect((await loadFaq("ja")).map((f) => f.a)).toEqual(["Answer one", "Answer two"]);
    await ins("news", { en: "P5 Old news" }, { en: "old" }, "published, published_at|true, '2024-01-01'"); await ins("news", { en: "P5 Pinned news", th: "P5 ข่าวปักหมุด" }, { en: "new" }, "published, pinned, published_at|true, true, now()");
    expect((await loadNews("en")).slice(0, 2).map((n) => n.title)).toEqual(["P5 Pinned news", "P5 Old news"]); expect((await pinnedNews("th"))?.title).toBe("P5 ข่าวปักหมุด");
    await sql(`delete from public.content_items where title->>'en' like 'P5 %'`);
    expect((await loadFaq("en")).length).toBe(FAQ.en.length); expect(await pinnedNews("en")).toBeNull();                                            // back to the built-in FAQ
  });
});

