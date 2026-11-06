// Live checks for Phase 4 against the REAL Supabase project and the partner simulator: help assistant, LINE / WhatsApp notices, agency portal, partner portal.
// (The assistant talks to the simulator's Messages API; a real Claude call is a separate, manual check.) Everything created is removed at the end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { HttpImmigrationGateway } from "@/lib/immigration/gateway";
import { syncFlatLists } from "@/lib/immigration/sync";
import { runAssistant } from "@/lib/ai/assistant";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { bindLine, confirmWhatsapp, disconnectChannel, monthCount, sendToChannels, startLineLink, startWhatsapp } from "@/lib/messaging/service";
import { notifyUser } from "@/lib/notify";
import { putSetting } from "@/lib/settings";
import { POST as lineWebhook } from "@/app/api/line/webhook/route";
import sharp from "sharp";
import { addMember, agencyStats, applyForAgency, importTravelers, isActiveMember, membershipOf, removeMember } from "@/lib/agency/service";
import { CSV_TEMPLATE } from "@/lib/agency/csv";
import { admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void>; state: { aiRequests: { model: string; system: string; tools: string[]; output_config: unknown }[]; messagesSent: Record<string, unknown>[] } }; let mockBase = "";
let masterWasEmpty = false; let aiRowBefore: { requests: number; input_tokens: number; output_tokens: number } | null = null; const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

beforeAll(async () => {
  masterWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.master_data"))[0].n) === 0;
  aiRowBefore = (await sql<{ requests: number; input_tokens: number; output_tokens: number }>(`select requests, input_tokens, output_tokens from public.ai_usage where day='${today()}'`))[0] ?? null;
  mock = createMockServer({ decisionDelayMs: 60, log: () => {} }); mockBase = `http://127.0.0.1:${await mock.listen(0)}`;
  Object.assign(process.env, { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: `${mockBase}/ai`, LINE_CHANNEL_ACCESS_TOKEN: "line-token", LINE_CHANNEL_SECRET: "line-secret", LINE_BASIC_ID: "@thaipass", LINE_API_URL: `${mockBase}/line`,
    WHATSAPP_TOKEN: "wa-token", WHATSAPP_PHONE_ID: "123", WHATSAPP_API_URL: `${mockBase}/whatsapp`, WHATSAPP_TEMPLATE_NOTICE: "status_update", WHATSAPP_TEMPLATE_CODE: "verify_code" });
  if (masterWasEmpty) await syncFlatLists(new HttpImmigrationGateway({ baseUrl: `${mockBase}/immigration/th/v1`, token: "jwt", from: "thaipass" }));
}, 300_000);

afterAll(async () => {
  const problems = await cleanupUsers();
  const clean = [masterWasEmpty ? "delete from public.master_data; delete from public.master_sync;" : "",
    aiRowBefore ? `update public.ai_usage set requests=${aiRowBefore.requests}, input_tokens=${aiRowBefore.input_tokens}, output_tokens=${aiRowBefore.output_tokens} where day='${today()}';` : `delete from public.ai_usage where day='${today()}';`].join(" ").trim();
  await sql("delete from public.platform_settings where key = 'messaging'").catch((e) => problems.push(String(e)));
  await sql(clean).catch((e) => problems.push(String(e)));
  await mock?.close();
  if (problems.length) throw new Error(`cleanup incomplete: ${problems.join("; ")}`);
}, 300_000);

describe("help assistant", () => {
  it("looks up the signed-in user's own application with a tool and answers from it; another user never sees it", async () => {
    const a = await makeUser("ai-a"); const b = await makeUser("ai-b"); const d = await makeDraft(a, "APR");
    const refA = (await admin.from("applications").select("ref_no").eq("id", d.appId).single()).data!.ref_no as string;
    const r = await runAssistant([{ role: "user", content: "What is the status of my application?" }], { userId: a.id, lang: "en" });
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.reply).toContain(refA); expect(r.reply).toContain("Draft");
    const other = await runAssistant([{ role: "user", content: "What is the status of my application?" }], { userId: b.id, lang: "en" });
    expect(other.ok && other.reply).toContain("no applications yet"); expect(other.ok && other.reply).not.toContain(refA);
    const anon = await runAssistant([{ role: "user", content: "what is the status of my application" }], { userId: null, lang: "en" });
    expect(anon.ok && anon.reply).toContain("Nobody is signed in");
    const req = mock.state.aiRequests.at(-1)!;                                        // what the model was given
    expect(req.tools).toEqual(["get_my_applications", "get_fees", "check_eligibility"]); expect(req.output_config).toEqual({ effort: "low" });
    expect(req.system).toContain("PRIVATE service"); expect(req.system).toContain("THB 2000");
  });
  it("answers price questions through the fees tool and eligibility through the list", async () => {
    const fees = await runAssistant([{ role: "user", content: "how much is the fee" }], { userId: null, lang: "en" });
    expect(fees.ok && fees.reply).toContain("visa_fee_thb"); expect(fees.ok && fees.reply).toContain("2000");
    const el = await runAssistant([{ role: "user", content: "am I eligible, I am Indian nationality" }], { userId: null, lang: "en" });
    expect(el.ok && el.reply).toMatch(/INDIA/);
  });
  it("stops at the daily budget, reports an unavailable service, and survives an API outage", async () => {
    await admin.rpc("ai_usage_add", { p_in: 700_000, p_out: 0 });
    expect(await runAssistant([{ role: "user", content: "hello" }], { userId: null, lang: "en" })).toEqual({ ok: false, error: "err_ai_budget" });
    await sql(`update public.ai_usage set input_tokens = 0, output_tokens = 0 where day='${today()}'`);
    expect(await runAssistant([{ role: "user", content: "BREAK-API please" }], { userId: null, lang: "en" })).toEqual({ ok: false, error: "err_ai_failed" });
    const key = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    expect(await runAssistant([{ role: "user", content: "hello" }], { userId: null, lang: "en" })).toEqual({ ok: false, error: "err_ai_unavailable" });
    process.env.ANTHROPIC_API_KEY = key;
    const ok = await runAssistant([{ role: "user", content: "hello" }], { userId: null, lang: "en" }); expect(ok.ok && ok.reply).toContain("Mock answer: hello");
  });
});

const sent = () => mock.state.messagesSent;
describe("LINE and WhatsApp notices", () => {
  const sign = (body: string) => createHmac("sha256", "line-secret").update(body).digest("base64");
  const hook = (body: object, signature?: string) => { const raw = JSON.stringify(body); return lineWebhook(new NextRequest("http://localhost/api/line/webhook", { method: "POST", body: raw, headers: { "x-line-signature": signature ?? sign(raw), "content-type": "application/json" } })); };

  it("LINE: the code links an account through the signed webhook, once, and a bad or unsigned call links nothing", async () => {
    const u = await makeUser("line");
    const start = await startLineLink(u.id); expect(start.ok).toBe(true); if (!start.ok) return;
    expect(start.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/); expect(start.basicId).toBe("@thaipass");
    const stored = (await sql<{ code_hash: string; status: string }>(`select code_hash, status from public.notification_channels where owner_id='${u.id}'`))[0];
    expect(stored.status).toBe("pending"); expect(stored.code_hash).not.toContain(start.code);                          // only a hash is kept
    expect((await hook({ events: [] }, "bad-signature")).status).toBe(401);
    expect(await bindLine("ABCDEFGH", "Uwrong")).toEqual({ ok: false });
    const ev = (text: string, user = "Uline1") => ({ events: [{ type: "message", replyToken: `rt-${text}`, source: { userId: user }, message: { type: "text", text } }] });
    expect((await hook(ev("hello there"))).status).toBe(200);
    expect(sent().some((m) => m.channel === "line-reply" && String(m.text).includes("8-character"))).toBe(true);        // help text, nothing linked
    expect((await sql<{ status: string }>(`select status from public.notification_channels where owner_id='${u.id}'`))[0].status).toBe("pending");
    expect((await hook(ev(`link ${start.code.toLowerCase()}`))).status).toBe(200);
    const row = (await sql<{ status: string; address: string }>(`select status, address from public.notification_channels where owner_id='${u.id}'`))[0];
    expect(row).toMatchObject({ status: "active", address: "Uline1" });
    expect(sent().some((m) => m.channel === "line-reply" && String(m.text).includes("Connected"))).toBe(true);
    expect(await bindLine(start.code, "Uother")).toEqual({ ok: false });                                                // a used code is dead
  });

  it("LINE: an expired code and a code guess from the wrong place do not link", async () => {
    const u = await makeUser("line-exp"); const s = await startLineLink(u.id); if (!s.ok) throw new Error("start");
    await sql(`update public.notification_channels set code_expires_at = now() - interval '1 minute' where owner_id='${u.id}'`);
    expect(await bindLine(s.code, "Uexp")).toEqual({ ok: false });
    await sql(`update public.notification_channels set code_expires_at = now() + interval '5 minutes', attempts = 5 where owner_id='${u.id}'`);
    expect(await bindLine(s.code, "Uexp")).toEqual({ ok: false });                                                      // too many attempts
  });

  it("WhatsApp: a template message carries the code; the right code activates, wrong codes lock after five, bad numbers are refused", async () => {
    const u = await makeUser("wa");
    expect(await startWhatsapp(u.id, "12ab")).toMatchObject({ ok: false, error: "err_phone_invalid" });
    expect(await startWhatsapp(u.id, "66912345000")).toMatchObject({ ok: false, error: "err_channel_send" });         // the service refuses this number
    expect(await startWhatsapp(u.id, "+66 91 234 5678")).toEqual({ ok: true });
    const code = String(sent().filter((m) => m.channel === "whatsapp" && m.template === "verify_code").at(-1)!.params && (sent().filter((m) => m.template === "verify_code").at(-1)!.params as string[])[0]);
    expect(code).toMatch(/^\d{6}$/);
    for (let i = 0; i < 2; i++) expect(await confirmWhatsapp(u.id, "000000")).toMatchObject({ ok: false });
    expect(await confirmWhatsapp(u.id, code)).toEqual({ ok: true });
    expect((await sql<{ status: string; address: string }>(`select status, address from public.notification_channels where owner_id='${u.id}'`))[0]).toMatchObject({ status: "active", address: "66912345678" });
    const w = await makeUser("wa-lock"); await startWhatsapp(w.id, "66987654321");
    for (let i = 0; i < 5; i++) await confirmWhatsapp(w.id, "111111");
    const real = (sent().filter((m) => m.template === "verify_code" && m.to === "66987654321").at(-1)!.params as string[])[0];
    expect(await confirmWhatsapp(w.id, real)).toMatchObject({ ok: false });                                             // locked even with the right code
  });

  it("a notice reaches the app, LINE and WhatsApp; a quota stops further chat messages; blocked and removed accounts stop", async () => {
    const u = await makeUser("both");
    const s = await startLineLink(u.id); if (!s.ok) throw new Error("start"); await bindLine(s.code, "Uboth");
    await startWhatsapp(u.id, "66911110000".replace(/000$/, "111"));
    const c = (sent().filter((m) => m.template === "verify_code").at(-1)!.params as string[])[0]; await confirmWhatsapp(u.id, c);
    const before = sent().length;
    await notifyUser({ userId: u.id, title: "Application approved", body: "Open your pass", link: "/pass", kind: "application.approved", dedupeKey: "p4:both:1" });
    const mine = sent().slice(before);
    expect(mine.find((m) => m.channel === "line")).toMatchObject({ to: "Uboth" }); expect(String(mine.find((m) => m.channel === "line")!.text)).toContain("Application approved");
    expect(String(mine.find((m) => m.channel === "line")!.text)).toContain("/pass");
    expect(mine.find((m) => m.channel === "whatsapp")).toMatchObject({ template: "status_update", to: "66911110111" });
    expect((await admin.from("app_notifications").select("id").eq("user_id", u.id).eq("dedupe_key", "p4:both:1")).data).toHaveLength(1);
    await notifyUser({ userId: u.id, title: "Application approved", body: "Open your pass", link: "/pass", kind: "application.approved", dedupeKey: "p4:both:1" });   // the same event again
    expect(sent().length - before).toBe(2);
    // quota: nothing more is sent through a channel that used its month
    const adminUser = await makeUser("both-admin", { admin: true });
    await putSetting("messaging", { line_enabled: true, whatsapp_enabled: true, line_quota: await monthCount("line"), whatsapp_quota: 100000 }, adminUser.id);
    const n1 = sent().length;
    await sendToChannels({ userId: u.id, title: "Second", kind: "x" });
    expect(sent().slice(n1).map((m) => m.channel)).toEqual(["whatsapp"]);
    expect((await sql<{ n: number }>(`select count(*) n from public.message_log where owner_id='${u.id}' and status='sent'`))[0].n).toBe(3);
    await disconnectChannel(u.id, "whatsapp"); const n2 = sent().length; await sendToChannels({ userId: u.id, title: "Third", kind: "x" }); expect(sent().length).toBe(n2);
  });

  it("a LINE account that blocked us is marked stopped after a permanent failure and is not tried again", async () => {
    const boss = await makeUser("blocked-admin", { admin: true }); await putSetting("messaging", { line_enabled: true, whatsapp_enabled: true, line_quota: 100000, whatsapp_quota: 100000 }, boss.id);   // the earlier quota test must not carry over
    const u = await makeUser("blocked"); const s = await startLineLink(u.id); if (!s.ok) throw new Error("start"); await bindLine(s.code, "UBLOCKED");
    await sendToChannels({ userId: u.id, title: "Hello", kind: "x" });
    expect((await sql<{ status: string; last_error: string }>(`select status, last_error from public.notification_channels where owner_id='${u.id}'`))[0]).toMatchObject({ status: "stopped" });
    const n = sent().length; await sendToChannels({ userId: u.id, title: "Again", kind: "x" }); expect(sent().length).toBe(n);
  });
});

describe("agency portal", () => {
  const agencyInput = { name: "Test Travel Co", contact_name: "Owner Person", contact_email: "owner@example.com", contact_phone: "+66 2 000 0000", country: "Thailand", license_no: "TAT-1" };
  it("a company registers (pending), its document stays private, and staff terms turn on the discount and the agency on its applications", async () => {
    const owner = await makeUser("ag-owner");
    const doc = new Uint8Array(await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer());
    const r = await applyForAgency(owner.id, agencyInput, doc); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(await applyForAgency(owner.id, agencyInput)).toMatchObject({ ok: false, error: "err_agency_exists" });
    expect(await membershipOf(owner.id)).toMatchObject({ role: "owner", agency: { id: r.id, status: "pending" } });
    expect(await isActiveMember(owner.id, r.id)).toBe(false);
    expect((await admin.from("documents").select("id").eq("agency_id", r.id)).data).toHaveLength(1);
    // a trip made for a pending agency gets no agency and no discount
    const before = await makeDraft(owner, "APR", { agencyId: r.id });
    expect((await admin.from("applications").select("agency_id, service_fee_thb").eq("id", before.appId).single()).data).toMatchObject({ agency_id: null, service_fee_thb: 600 });
    // staff approve with terms
    await admin.from("agencies").update({ status: "active", discount_thb: 100, commission_pct: 10 }).eq("id", r.id);
    expect(await isActiveMember(owner.id, r.id)).toBe(true);
    const d = await makeDraft(owner, "APR", { agencyId: r.id });
    expect((await admin.from("applications").select("agency_id, service_fee_thb, visa_fee_thb").eq("id", d.appId).single()).data).toMatchObject({ agency_id: r.id, service_fee_thb: 500, visa_fee_thb: 2000 });
    // somebody who is not a member cannot attach a trip to the agency
    const stranger = await makeUser("ag-stranger"); const s = await makeDraft(stranger, "APR", { agencyId: r.id });
    expect((await admin.from("applications").select("agency_id, service_fee_thb").eq("id", s.appId).single()).data).toMatchObject({ agency_id: null, service_fee_thb: 600 });
    // the registration document is never purged as a "loose upload"
    await sql(`update public.documents set created_at = now() - interval '30 days' where agency_id='${r.id}'`);
    const due = await admin.rpc("documents_due_for_purge", { p_days: 90, p_limit: 1000 }); const agencyDoc = (await admin.from("documents").select("id").eq("agency_id", r.id).single()).data!.id;
    expect(((due.data ?? []) as { id: string }[]).some((x) => x.id === agencyDoc)).toBe(false);
    // commission counts paid applications' service fees only
    await admin.rpc("transition_application", { p_id: d.appId, p_to: "awaiting_payment", p_reason: null, p_source: "system", p_actor: null, p_only_from: ["draft"] });
    await admin.rpc("transition_application", { p_id: d.appId, p_to: "paid", p_reason: null, p_source: "payment", p_actor: null, p_only_from: ["awaiting_payment"] });
    const st = await agencyStats(r.id, new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)));
    expect(st).toMatchObject({ applications: 1, paid: 1, serviceFeesThb: 500, commissionPct: 10, commissionThb: 50 });
    // team: only the owner adds, only registered people, one agency per person
    const colleague = await makeUser("ag-col"); await admin.from("profiles").update({ email: colleague.email }).eq("id", colleague.id);
    expect(await addMember(colleague.id, r.id, "x@example.com")).toMatchObject({ ok: false, error: "err_forbidden" });
    expect(await addMember(owner.id, r.id, "nobody-here@example.com")).toMatchObject({ ok: false, error: "err_agency_no_account" });
    expect(await addMember(owner.id, r.id, colleague.email)).toEqual({ ok: true });
    expect(await addMember(owner.id, r.id, colleague.email)).toMatchObject({ ok: false, error: "err_agency_exists" });
    expect((await colleague.client.from("agency_members").select("user_id")).data).toHaveLength(1);        // sees only their own membership
    expect((await stranger.client.from("agency_members").select("user_id")).data).toEqual([]);
    expect(await removeMember(colleague.id, r.id, owner.id)).toBe(false); expect(await removeMember(owner.id, r.id, colleague.id)).toBe(true);
  });

  it("a CSV adds travelers to the agent's book: good rows are saved, bad rows are named, a second import updates instead of duplicating", async () => {
    const u = await makeUser("ag-csv");
    const head = CSV_TEMPLATE.split("\n")[0], row = (n: number, nat = "IND", sex = "M") => `Test${n},,Person${n},${sex},1985-01-0${n},${nat},P${1000000 + n},2021-03-09,2031-03-08,Delhi,t${n}@example.com,91234567${n}`;
    const text = [head, row(1), row(2, "CHN", "F"), row(3, "XXX"), row(4, "IND", "Q")].join("\n");
    const r = await importTravelers(u.id, text);
    expect(r.fatal).toBeUndefined(); expect(r.created).toBe(2); expect(r.updated).toBe(0);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5]); expect(r.errors[0].message).toContain("XXX");
    expect((await admin.from("travelers").select("id, relation").eq("owner_id", u.id)).data).toHaveLength(2);
    const again = await importTravelers(u.id, [head, row(1)].join("\n")); expect(again).toMatchObject({ created: 0, updated: 1 });
    expect((await admin.from("travelers").select("id").eq("owner_id", u.id)).data).toHaveLength(2);
    expect((await importTravelers(u.id, "given_name,surname\nA,B")).fatal).toMatch(/columns/);
  });
});
