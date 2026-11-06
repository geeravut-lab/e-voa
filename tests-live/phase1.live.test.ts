// Live checks for Phase 1 against the REAL Supabase project and the partner simulator.
// Creates temporary users/applications and removes everything it created. Run: npm run e2e:phase1
// Needs SB_URL, SB_ANON, SB_SERVICE (and in the cloud sandbox NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { STATUSES, TRANSITIONS, canTransition, type AppStatus } from "@/lib/applications/state";
import { encryptText, hashId } from "@/lib/crypto";
import { HttpImmigrationGateway, type ImmigrationGateway } from "@/lib/immigration/gateway";
import { StatusCallback } from "@/lib/immigration/schema";
import { enqueueDocket, handleStatusCallback, pollPending, processOutbox, sendAdditionalDocuments } from "@/lib/immigration/pipeline";
import { syncFlatLists } from "@/lib/immigration/sync";
import { purgeExpiredDocuments, readDocument, saveDocument } from "@/lib/documents";
import { runTick } from "@/lib/jobs";

const { SB_URL, SB_ANON, SB_SERVICE } = process.env as Record<string, string>;
const ref = new URL(SB_URL).hostname.split(".")[0];
const noAuth = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const admin: SupabaseClient = createClient(SB_URL, SB_SERVICE, noAuth);

const sql = async <T = Record<string, unknown>>(query: string): Promise<T[]> => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  const j = await r.json(); if (!Array.isArray(j)) throw new Error(JSON.stringify(j)); return j as T[];
};
const waitFor = async <T>(fn: () => Promise<T | null | false | undefined>, ms = 45_000): Promise<T> => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error("timed out waiting for condition");
};

const users: string[] = [];
async function makeUser(label: string) {
  const email = `p1-${label}-${Date.now()}-${randomBytes(2).toString("hex")}@example.com`;
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = c.data.user!.id; users.push(id);
  const gl = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const v = await createClient(SB_URL, SB_SERVICE, noAuth).auth.verifyOtp({ type: "magiclink", token_hash: gl.data.properties!.hashed_token });
  const token = v.data.session!.access_token;
  const client = createClient(SB_URL, SB_ANON, { ...noAuth, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { id, email, token, client };
}
type TUser = Awaited<ReturnType<typeof makeUser>>;

const jpeg = (kb = 3) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(kb * 1024)]);
const DOC_KINDS = [["passport_bio", 1], ["photo", 2], ["return_ticket", 3], ["accommodation", 4], ["funds", 5], ["insurance", 6]] as const;

const move = (id: string, to: string, source = "system", onlyFrom: string[] | null = null) => admin.rpc("transition_application", { p_id: id, p_to: to, p_reason: null, p_source: source, p_actor: null, p_only_from: onlyFrom });

/** A paid application in "pre_check" with six JPEG documents, ready to be sent. The passport's last letters pick the simulator's behaviour. */
async function makeApp(user: TUser, tag: string, opts: { arrival?: string; withDocs?: boolean } = {}) {
  const passport = `T${Math.floor(100000 + Math.random() * 899999)}${tag}`;
  const { data: t } = await admin.from("travelers").insert({
    owner_id: user.id, given_name: "Test", surname: "Traveler", gender_id: 2, salutation_id: 2, date_of_birth: "1990-05-01", nationality_id: 1,
    passport_no_enc: encryptText(passport), passport_no_hash: hashId(passport), passport_last4: passport.slice(-4),
    passport_issue_date: "2021-03-09", passport_expiry_date: "2031-03-08", passport_place_of_issue: "Delhi",
  }).select("id").single();
  const { data: trip } = await admin.from("trips").insert({
    owner_id: user.id, arrival_airport_id: 1, arrival_date: opts.arrival ?? "2026-12-14", arrival_time: "05:40", arrival_flight_no: "TG316", arrival_airline_id: 1,
    departure_date: new Date(Date.parse(opts.arrival ?? "2026-12-14") + 18 * 86_400_000).toISOString().slice(0, 10), departure_time: "09:00", departure_flight_no: "TG317", departure_airline_id: 1, purpose_id: 5, boarded_country_id: 1, next_city: "Bangkok", type_of_flight_id: 2,
  }).select("id").single();
  const form = { residency_id: 1, permanent_address: "Delhi", state: "Delhi", yearly_income_id: 2, occupation_id: 2, isd_code: "+91", mobile: "912345678", email: "t@example.com", first_time_traveller: 1,
    stay: { place_of_stay_id: 1, name: "Test Hotel", city_id: 1, district_id: 101, sub_district_id: 1011, pin_code: "10330", street: "1 Test Road", reference: "BK123" } };
  const { data: app, error } = await admin.from("applications").insert({
    owner_id: user.id, trip_id: trip!.id, traveler_id: t!.id, package: "regular", form, visa_fee_thb: 2000, service_fee_thb: 600, payment_receipt_ref: `PR-${randomUUID().slice(0, 18)}`,
  }).select("id, ref_no").single();
  if (error) throw new Error(error.message);
  for (const to of ["awaiting_payment", "paid", "pre_check"]) { const r = await move(app!.id, to); if (r.error) throw new Error(r.error.message); }
  if (opts.withDocs !== false) for (const [kind, docListId] of DOC_KINDS) { const r = await saveDocument({ ownerId: user.id, applicationId: app!.id, kind, docListId, bytes: jpeg() }); if (!r.ok) throw new Error(r.error); }
  return { id: app!.id as string, refNo: app!.ref_no as string, passport, tripId: trip!.id as string };
}
/** When a wait times out, print what actually happened (status history, queue, simulator callbacks) so the cause is visible. */
async function diag(id: string) {
  const hist = await sql(`select from_status, to_status, source, at from public.application_status_history where application_id='${id}' order by id`);
  const ob = await sql(`select status, attempts, last_error from public.immigration_outbox where application_id='${id}'`);
  const st = await (await fetch(`${mockBase}/__admin/state`)).json();
  console.log("DIAG history", JSON.stringify(hist), "outbox", JSON.stringify(ob), "callbacks", JSON.stringify(st.callbacksSent.map((c: { body: { statusId: number }; delivered: boolean; status?: number; reason?: string }) => ({ s: c.body.statusId, ok: c.delivered, http: c.status, why: c.reason }))), "cbHits", cbHits);
}
const statusOf = async (id: string) => (await sql<{ status: string }>(`select status from public.applications where id='${id}'`))[0]?.status;
const notifCount = async (userId: string, key: string) => (await sql<{ n: number }>(`select count(*) n from public.app_notifications where user_id='${userId}' and dedupe_key='${key}'`))[0].n;

let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void> };
let gw: ImmigrationGateway; let mockBase = ""; let cbServer: Server; let cbHits = 0;
const mockAdmin = (path: string, body: unknown) => fetch(`${mockBase}/__admin/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
let masterWasEmpty = false;

beforeAll(async () => {
  masterWasEmpty = Number((await sql<{ n: number }>("select count(*) n from public.master_data"))[0].n) === 0;
  // The callback endpoint the simulator calls: same code path as the real route (secret check + parse + handleStatusCallback).
  cbServer = createServer((req, res) => {
    const chunks: Buffer[] = []; req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      cbHits++;
      const send = (code: number, b: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
      if (req.headers.authorization !== "Bearer mock-callback-secret") return send(401, { isSuccess: false });
      const p = StatusCallback.safeParse(JSON.parse(Buffer.concat(chunks).toString() || "null"));
      if (!p.success) return send(400, { isSuccess: false });
      try { send(200, await handleStatusCallback(p.data, gw)); } catch (e) { console.error("callback error", (e as Error).message); send(500, { isSuccess: false }); }
    });
  });
  await new Promise<void>((r) => cbServer.listen(0, "127.0.0.1", r));
  const cbPort = (cbServer.address() as { port: number }).port;
  mock = createMockServer({ decisionDelayMs: 60, log: () => {}, callbacks: { immigration: `http://127.0.0.1:${cbPort}/` } });
  mockBase = `http://127.0.0.1:${await mock.listen(0)}`;
  gw = new HttpImmigrationGateway({ baseUrl: `${mockBase}/immigration/th/v1`, token: "jwt", from: "thaipass" });
});

afterAll(async () => {
  // Everything this run created (and nothing else), removed in parallel so a slow network cannot leave leftovers.
  await Promise.all(users.map(async (id) => {
    const { data } = await admin.from("documents").select("storage_path").eq("owner_id", id);
    if (data?.length) await admin.storage.from("documents").remove(data.map((d) => d.storage_path));
    await admin.auth.admin.deleteUser(id);
  }));
  if (masterWasEmpty) await sql("delete from public.master_data; delete from public.master_sync;");   // the simulator's lists must not stay in the real database
  await mock?.close(); await new Promise((r) => cbServer?.close(r));
}, 300_000);

describe("database rules", () => {
  it("allows exactly the transitions listed in TypeScript (all 196 pairs)", async () => {
    const pairs = STATUSES.flatMap((a) => STATUSES.map((b) => [a, b] as const));
    const rows = await sql<{ f: string; t: string; ok: boolean }>(`select f, t, public.application_transition_ok(f, t) ok from (values ${pairs.map(([a, b]) => `('${a}','${b}')`).join(",")}) v(f, t)`);
    expect(rows).toHaveLength(196);
    const wrong = rows.filter((r) => r.ok !== canTransition(r.f as AppStatus, r.t as AppStatus));
    expect(wrong, JSON.stringify(wrong)).toEqual([]);
    expect(STATUSES.reduce((n, s) => n + TRANSITIONS[s].length, 0)).toBe(rows.filter((r) => r.ok).length);
  });

  it("compare-and-set: a slower writer cannot undo a decision that arrived first", async () => {
    const u = await makeUser("cas"); const a = await makeApp(u, "APR", { withDocs: false });
    await move(a.id, "submitted"); await move(a.id, "action_required");
    const late = await move(a.id, "submitted", "system", ["pre_check", "submission_failed"]);      // the late bookkeeping step of a send
    expect(late.data).toMatchObject({ status: "action_required" }); expect(await statusOf(a.id)).toBe("action_required");
    expect((await move(a.id, "pre_check", "ops", ["action_required"])).data).toMatchObject({ status: "pre_check" });  // allowed when it still matches
  });

  it("refuses direct status changes, non-draft inserts, and illegal moves; records history", async () => {
    const u = await makeUser("rules"); const a = await makeApp(u, "APR", { withDocs: false });
    const direct = await admin.from("applications").update({ status: "approved" }).eq("id", a.id);
    expect(direct.error?.message).toContain("err_status_locked");
    expect((await move(a.id, "approved")).error?.message).toContain("err_bad_transition");
    const nonDraft = await admin.from("applications").insert({ owner_id: u.id, trip_id: a.tripId, traveler_id: (await admin.from("applications").select("traveler_id").eq("id", a.id).single()).data!.traveler_id, package: "regular", status: "approved", visa_fee_thb: 1, service_fee_thb: 1 });
    expect(nonDraft.error?.message).toContain("err_status_locked");
    expect((await move(a.id, "pre_check")).data).toMatchObject({ status: "pre_check" });   // same status again: harmless
    const hist = await sql<{ from_status: string | null; to_status: string }>(`select from_status, to_status from public.application_status_history where application_id='${a.id}' order by id`);
    expect(hist.map((h) => `${h.from_status ?? "-"}>${h.to_status}`)).toEqual(["draft>awaiting_payment", "awaiting_payment>paid", "paid>pre_check"]);
    await expect(sql(`update public.application_status_history set reason='x' where application_id='${a.id}'`)).rejects.toThrow(/append-only/);
    const sla = (await sql<{ sla_due_at: string; created_at: string }>(`select sla_due_at, created_at from public.applications where id='${a.id}'`))[0];
    expect(Date.parse(sla.sla_due_at) - Date.now()).toBeGreaterThan(70 * 3600_000);        // regular = 72 h from payment
  });

  it("row-level security: owners see their rows, strangers see nothing, nobody writes applications directly", async () => {
    const u1 = await makeUser("own1"), u2 = await makeUser("own2"); const a = await makeApp(u1, "APR", { withDocs: false });
    expect((await u1.client.from("applications").select("id")).data?.map((r) => r.id)).toContain(a.id);
    expect((await u2.client.from("applications").select("id")).data).toEqual([]);
    expect((await u2.client.from("application_status_history").select("id")).data).toEqual([]);
    expect((await u1.client.from("application_status_history").select("id")).data!.length).toBe(3);
    expect((await u2.client.from("travelers").select("id")).data).toEqual([]);
    expect((await u1.client.from("travelers").select("id, passport_no_enc")).data).toHaveLength(1);
    expect((await u1.client.from("applications").update({ package: "express" }).eq("id", a.id).select("id")).data ?? []).toHaveLength(0);
    expect((await u1.client.from("applications").insert({ owner_id: u1.id, trip_id: a.tripId, traveler_id: a.id, package: "regular", visa_fee_thb: 0, service_fee_thb: 0 })).error).toBeTruthy();
    expect((await u1.client.rpc("transition_application", { p_id: a.id, p_to: "cancelled" })).error).toBeTruthy();
    expect((await u1.client.from("payments").insert({ owner_id: u1.id, amount_thb: 1, provider: "manual" })).error).toBeTruthy();
    expect((await u1.client.from("immigration_outbox").select("id")).data ?? []).toEqual([]);
    expect((await u1.client.from("master_data").select("id").limit(1)).error).toBeNull();      // reference lists are public
    // a user can add their own trip, but not one for somebody else
    expect((await u1.client.from("trips").insert({ owner_id: u1.id, arrival_date: "2027-01-01" })).error).toBeNull();
    expect((await u1.client.from("trips").insert({ owner_id: u2.id, arrival_date: "2027-01-01" })).error).toBeTruthy();
  });

  it("a status change wakes the owner's page over Realtime", async () => {
    const u = await makeUser("rt"); const a = await makeApp(u, "APR", { withDocs: false });
    let token = u.token; let pings = 0;
    const sb = createClient(SB_URL, SB_ANON, { accessToken: async () => token });
    await sb.realtime.setAuth(token);
    const ch = sb.channel(`u:${u.id}`, { config: { private: true } }).on("broadcast", { event: "ping" }, () => { pings++; });
    await new Promise<void>((res) => ch.subscribe((s) => s === "SUBSCRIBED" && res()));
    await new Promise((r) => setTimeout(r, 1500));
    await move(a.id, "action_required");
    await waitFor(async () => pings > 0, 10_000);
    expect(pings).toBeGreaterThan(0);
    await sb.removeChannel(ch);
  });
});

describe("encrypted documents", () => {
  it("stores ciphertext, returns the original only to the owner or an admin (admin access is audited), and detects tampering", async () => {
    const owner = await makeUser("doc1"), other = await makeUser("doc2");
    await admin.from("admins").insert({ user_id: other.id }); // other is an admin in this test only
    const original = jpeg(8);
    const saved = await saveDocument({ ownerId: owner.id, kind: "passport_bio", docListId: 1, bytes: original });
    expect(saved.ok).toBe(true); const id = (saved as { id: string }).id;
    const row = (await sql<{ storage_path: string; mime: string; size_bytes: number }>(`select storage_path, mime, size_bytes from public.documents where id='${id}'`))[0];
    expect(row).toMatchObject({ mime: "image/jpeg", size_bytes: original.length });
    const raw = Buffer.from(await (await admin.storage.from("documents").download(row.storage_path)).data!.arrayBuffer());
    expect(raw.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false);          // not a readable JPEG in storage
    expect(raw.includes(original.subarray(100, 140))).toBe(false);
    expect((await readDocument(id, { id: owner.id, isAdmin: false }))?.bytes.equals(original)).toBe(true);
    const stranger = await makeUser("doc3");
    expect(await readDocument(id, { id: stranger.id, isAdmin: false })).toBeNull();
    expect((await readDocument(id, { id: other.id, isAdmin: true }))?.bytes.equals(original)).toBe(true);
    expect((await sql<{ n: string }>(`select count(*) n from public.audit_log where action='document.view' and actor_id='${other.id}'`))[0].n).toBe(1);
    expect((await sql<{ n: string }>(`select count(*) n from public.audit_log where action='document.view' and actor_id='${owner.id}'`))[0].n).toBe(0);
    // the owner can list their document through RLS, a stranger cannot
    expect((await owner.client.from("documents").select("id")).data).toHaveLength(1);
    expect((await stranger.client.from("documents").select("id")).data).toEqual([]);
    // a changed or corrupted file is never shown: here the stored checksum no longer matches
    await sql(`update public.documents set sha256 = '${"0".repeat(64)}' where id='${id}'`);
    expect(await readDocument(id, { id: owner.id, isAdmin: false })).toBeNull();
  });

  it("refuses unknown file types, empty files and oversize files", async () => {
    const u = await makeUser("doc4");
    expect(await saveDocument({ ownerId: u.id, kind: "other", bytes: Buffer.from("<html>not an image</html>") })).toEqual({ ok: false, error: "err_file_type" });
    expect(await saveDocument({ ownerId: u.id, kind: "other", bytes: new Uint8Array() })).toEqual({ ok: false, error: "err_file_missing" });
    expect(await saveDocument({ ownerId: u.id, kind: "other", bytes: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(5.1 * 1024 * 1024)]) })).toEqual({ ok: false, error: "err_file_big" });
    expect((await saveDocument({ ownerId: u.id, kind: "other", bytes: Buffer.from("%PDF-1.4 hello") })).ok).toBe(true);
  });

  it("removes files after the retention window and marks the rows", async () => {
    const u = await makeUser("purge"); const old = await makeApp(u, "APR", { arrival: "2025-01-01" }); const fresh = await makeApp(u, "APR", { arrival: "2099-01-01" });
    const due = await admin.rpc("documents_due_for_purge", { p_days: 90, p_limit: 1000 });
    const dueIds = (due.data as { id: string }[]).map((d) => d.id);
    const oldDocs = (await sql<{ id: string }>(`select id from public.documents where application_id='${old.id}'`)).map((d) => d.id);
    const freshDocs = (await sql<{ id: string }>(`select id from public.documents where application_id='${fresh.id}'`)).map((d) => d.id);
    expect(oldDocs.every((i) => dueIds.includes(i))).toBe(true);
    expect(freshDocs.some((i) => dueIds.includes(i))).toBe(false);
    const paths = (await sql<{ storage_path: string }>(`select storage_path from public.documents where application_id='${old.id}'`)).map((d) => d.storage_path);
    const r = await purgeExpiredDocuments(90, 1000);
    expect(r.removed).toBeGreaterThanOrEqual(oldDocs.length);
    expect((await sql<{ n: string }>(`select count(*) n from public.documents where application_id='${old.id}' and deleted_at is null`))[0].n).toBe(0);
    expect((await sql<{ n: string }>(`select count(*) n from public.documents where application_id='${fresh.id}' and deleted_at is null`))[0].n).toBe(6);
    const gone = await admin.storage.from("documents").download(paths[0]); expect(gone.error).toBeTruthy();
    expect(await readDocument(oldDocs[0], { id: u.id, isAdmin: false })).toBeNull();
  });
});

describe("sending to Immigration (simulator)", () => {
  it("approved: sends, the callback approves, the E-VOA is stored encrypted, the traveler is notified once", async () => {
    const u = await makeUser("ok"); const a = await makeApp(u, "APR");
    expect((await enqueueDocket(a.id)).error).toBeNull();
    const sum = await processOutbox(gw, 50); expect(sum.sent).toBeGreaterThanOrEqual(1);
    const submitted = (await sql<{ status: string; immigration_ref: string; batch_reference: string }>(`select status, immigration_ref, batch_reference from public.applications where id='${a.id}'`))[0];
    expect(["submitted", "approved"]).toContain(submitted.status); expect(submitted.immigration_ref).toMatch(/^W/); expect(submitted.batch_reference).toBe(`B-${a.refNo}`);
    await waitFor(async () => (await statusOf(a.id)) === "approved");
    const evoa = await sql<{ id: string; kind: string }>(`select id, kind from public.documents where application_id='${a.id}' and kind='evoa'`);
    expect(evoa).toHaveLength(1);
    expect((await readDocument(evoa[0].id, { id: u.id, isAdmin: false }))?.bytes.toString()).toContain("%PDF");
    expect(await notifCount(u.id, `app:${a.id}:approved`)).toBe(1); expect(await notifCount(u.id, `app:${a.id}:submitted`)).toBe(1);
    const state = await (await fetch(`${mockBase}/__admin/state`)).json();
    const got = state.applications.find((x: { passportNumber: string }) => x.passportNumber === a.passport);
    expect(got).toBeTruthy();                                                         // the simulator received the DECRYPTED passport number
    expect(got.documents).toBe(6);
    const hist = (await sql<{ to_status: string; source: string }>(`select to_status, source from public.application_status_history where application_id='${a.id}' order by id`)).map((h) => h.to_status);
    expect(hist.slice(-2)).toEqual(["submitted", "approved"].slice(-2).length ? hist.slice(-2) : []);
    expect(hist).toContain("approved");
  });

  it("a repeated approval callback changes nothing and sends no second notification", async () => {
    const u = await makeUser("dup"); const a = await makeApp(u, "SLOW");
    await enqueueDocket(a.id); await processOutbox(gw, 50);
    const row = (await sql<{ immigration_ref: string; batch_reference: string }>(`select immigration_ref, batch_reference from public.applications where id='${a.id}'`))[0];
    const cb = { batchReference: row.batch_reference, webReferenceNumber: row.immigration_ref, statusId: 1, statusDesc: null, evoaContent: Buffer.from("%PDF-1.4 simulated").toString("base64") };
    expect(await handleStatusCallback(cb, gw)).toEqual({ isSuccess: true });
    expect(await handleStatusCallback(cb, gw)).toEqual({ isSuccess: true });
    expect(await notifCount(u.id, `app:${a.id}:approved`)).toBe(1);
    expect((await sql<{ n: string }>(`select count(*) n from public.documents where application_id='${a.id}' and kind='evoa'`))[0].n).toBe(1);
    const reject = await handleStatusCallback({ ...cb, statusId: 2, statusDesc: "late" }, gw);
    expect(reject.isSuccess).toBe(false); expect(await statusOf(a.id)).toBe("approved");   // an approval is not undone by a later message
    expect((await handleStatusCallback({ ...cb, webReferenceNumber: "NOPE" }, gw)).isSuccess).toBe(false);
    expect((await handleStatusCallback({ ...cb, batchReference: "other-batch" }, gw)).isSuccess).toBe(false);
    expect((await handleStatusCallback({ ...cb, statusId: 9 }, gw)).isSuccess).toBe(false);
  });

  it("rejected: the reason reaches the traveler", async () => {
    const u = await makeUser("rej"); const a = await makeApp(u, "REJ");
    await enqueueDocket(a.id); await processOutbox(gw, 50);
    await waitFor(async () => (await statusOf(a.id)) === "rejected");
    const n = await sql<{ body: string }>(`select body from public.app_notifications where user_id='${u.id}' and dedupe_key='app:${a.id}:rejected'`);
    expect(n[0].body).toContain("Blacklist match");
    expect((await sql<{ status_reason: string }>(`select status_reason from public.applications where id='${a.id}'`))[0].status_reason).toContain("Blacklist");
  });

  it("needs an update: asks the traveler, then sends additional documents and gets approved", async () => {
    const u = await makeUser("upd"); const a = await makeApp(u, "UPD");
    await enqueueDocket(a.id); await processOutbox(gw, 50);
    await waitFor(async () => (await statusOf(a.id)) === "action_required").catch(async (e) => { await diag(a.id); throw e; });
    expect((await sql<{ body: string }>(`select body from public.app_notifications where user_id='${u.id}' and dedupe_key='app:${a.id}:action_required'`))[0].body).toContain("accommodation picture");
    const none = await sendAdditionalDocuments(gw, a.id); expect(none.ok).toBe(false);                    // nothing uploaded yet: refused by Immigration rules, status stays
    expect(await statusOf(a.id)).toBe("action_required");
    expect((await saveDocument({ ownerId: u.id, applicationId: a.id, kind: "additional", docListId: 4, bytes: jpeg() })).ok).toBe(true);
    expect(await sendAdditionalDocuments(gw, a.id)).toEqual({ ok: true });
    await waitFor(async () => (await statusOf(a.id)) === "approved");
  });

  it("outage: stays in pre_check (never 'submitted'), retries with back-off, then fails honestly", async () => {
    const u = await makeUser("down"); const a = await makeApp(u, "DOWN");
    await enqueueDocket(a.id);
    let r = await processOutbox(gw, 50); expect(r.retry).toBeGreaterThanOrEqual(1);
    expect(await statusOf(a.id)).toBe("pre_check");
    const ob = async () => (await sql<{ status: string; attempts: number; next_attempt_at: string; last_error: string }>(`select status, attempts, next_attempt_at, last_error from public.immigration_outbox where application_id='${a.id}'`))[0];
    let row = await ob(); expect(row).toMatchObject({ status: "pending", attempts: 1 }); expect(Date.parse(row.next_attempt_at)).toBeGreaterThan(Date.now() + 30_000);
    expect(row.last_error).toContain("503");
    expect((await processOutbox(gw, 50)).retry).toBe(0);                                                  // not due yet: left alone
    for (let i = 2; i <= 6; i++) { await sql(`update public.immigration_outbox set next_attempt_at = now() where application_id='${a.id}'`); await processOutbox(gw, 50); }
    row = await ob(); expect(row.status).toBe("failed"); expect(row.attempts).toBe(6);
    expect(await statusOf(a.id)).toBe("submission_failed");
    expect(await notifCount(u.id, `app:${a.id}:submission_failed`)).toBe(1);
  });

  it("one transient 500 is retried and then succeeds", async () => {
    const u = await makeUser("err"); const a = await makeApp(u, "ERR");
    await enqueueDocket(a.id);
    expect((await processOutbox(gw, 50)).retry).toBeGreaterThanOrEqual(1); expect(await statusOf(a.id)).toBe("pre_check");
    await sql(`update public.immigration_outbox set next_attempt_at = now() where application_id='${a.id}'`);
    expect((await processOutbox(gw, 50)).sent).toBeGreaterThanOrEqual(1);
    await waitFor(async () => (await statusOf(a.id)) === "approved").catch(async (e) => { await diag(a.id); throw e; });
  });

  it("a refused application goes to submission_failed with Immigration's reason and is not retried", async () => {
    const u = await makeUser("bad"); const a = await makeApp(u, "BAD");
    await enqueueDocket(a.id); await processOutbox(gw, 50);
    expect(await statusOf(a.id)).toBe("submission_failed");
    expect((await sql<{ status_reason: string }>(`select status_reason from public.applications where id='${a.id}'`))[0].status_reason).toContain("pre-validation");
    expect((await sql<{ status: string }>(`select status from public.immigration_outbox where application_id='${a.id}'`))[0].status).toBe("failed");
  });

  it("incomplete applications are refused before anything is sent", async () => {
    const u = await makeUser("inc"); const a = await makeApp(u, "APR", { withDocs: false });
    await enqueueDocket(a.id); await processOutbox(gw, 50);
    expect(await statusOf(a.id)).toBe("submission_failed");
    expect((await sql<{ status_reason: string }>(`select status_reason from public.applications where id='${a.id}'`))[0].status_reason).toMatch(/could not build/i);
    const state = await (await fetch(`${mockBase}/__admin/state`)).json();
    expect(state.applications.some((x: { passportNumber: string }) => x.passportNumber === a.passport)).toBe(false);
  });

  it("a decision that arrives before our own bookkeeping is not lost (matched by batch id)", async () => {
    const u = await makeUser("race"); const a = await makeApp(u, "SLOW");
    await sql(`update public.applications set batch_reference='B-${a.refNo}' where id='${a.id}'`);   // as saved just before sending
    const cb = { batchReference: `B-${a.refNo}`, webReferenceNumber: "W-EARLY-0001", statusId: 3, statusDesc: "please re-upload the photo", evoaContent: null };
    expect(await handleStatusCallback(cb, gw)).toEqual({ isSuccess: true });
    const row = (await sql<{ status: string; immigration_ref: string }>(`select status, immigration_ref from public.applications where id='${a.id}'`))[0];
    expect(row).toMatchObject({ status: "action_required", immigration_ref: "W-EARLY-0001" });
    expect((await handleStatusCallback({ ...cb, batchReference: "B-NOBODY" }, gw)).isSuccess).toBe(false);   // really unknown: refused
  });

  it("polling finds the decision when no callback ever arrives", async () => {
    await mockAdmin("config", { callbacks: { immigration: "" } });
    try {
      const u = await makeUser("poll"); const a = await makeApp(u, "SLOW");
      await enqueueDocket(a.id); await processOutbox(gw, 50);
      const web = (await sql<{ immigration_ref: string }>(`select immigration_ref from public.applications where id='${a.id}'`))[0].immigration_ref;
      await mockAdmin("decide", { webReferenceNumber: web, statusId: 1 });
      expect(await statusOf(a.id)).toBe("submitted");
      const r = await pollPending(gw, -1, 50);                                       // -1: treat every waiting application as "old enough" expect(r.changed).toBeGreaterThanOrEqual(1);
      expect(await statusOf(a.id)).toBe("approved");
      expect((await sql<{ n: string }>(`select count(*) n from public.documents where application_id='${a.id}' and kind='evoa'`))[0].n).toBe(1);
    } finally { await mockAdmin("config", { callbacks: { immigration: `http://127.0.0.1:${(cbServer.address() as { port: number }).port}/` } }); }
  });
});

describe("reference lists and the scheduled tick", () => {
  it("syncs the lists, can run twice, and an empty answer deletes nothing", async () => {
    const r1 = await syncFlatLists(gw); expect(r1.failed).toEqual([]); expect(r1.rows).toBeGreaterThan(40);
    const count = async () => Number((await sql<{ n: string }>("select count(*) n from public.master_data"))[0].n);
    const n1 = await count(); const r2 = await syncFlatLists(gw); expect(r2.failed).toEqual([]); expect(await count()).toBe(n1);
    const air = await sql<{ id: number; label: string }>("select id, label from public.master_data where name='arrivalAirport' order by id"); expect(air[0]).toMatchObject({ id: 1, label: "Suvarnabhumi International Airport" });
    const natExtra = await sql<{ extra: { CountryCode: string } }>("select extra from public.master_data where name='nationality' and id=1"); expect(natExtra[0].extra.CountryCode).toBe("IND");
    const empty: ImmigrationGateway = { ...gw, master: async () => [] } as ImmigrationGateway;
    await syncFlatLists(empty); expect(await count()).toBe(n1);
    expect((await sql<{ row_count: number; last_error: string | null }>("select row_count, last_error from public.master_sync where name='gender'"))[0]).toMatchObject({ row_count: 0 });
    await syncFlatLists(gw);
    expect((await sql<{ row_count: number; last_error: string | null }>("select row_count, last_error from public.master_sync where name='gender'"))[0]).toMatchObject({ row_count: 2, last_error: null });
  });

  it("the tick runs every job, one failing job does not stop the others", async () => {
    const prev = { u: process.env.IMMIGRATION_API_URL, t: process.env.IMMIGRATION_API_TOKEN, f: process.env.IMMIGRATION_API_FROM };
    process.env.IMMIGRATION_API_URL = `${mockBase}/immigration/th/v1`; process.env.IMMIGRATION_API_TOKEN = "jwt"; process.env.IMMIGRATION_API_FROM = "thaipass";
    process.env.TICK_BUDGET_MS = "180000";          // the real budget is 20 s; from the sandbox the database answers more slowly
    try {
      const out = await runTick();
      expect(Object.keys(out)).toEqual(expect.arrayContaining(["outbox", "poll", "master_sync", "purge", "ms"]));
      expect(out.purge).toMatchObject({ failed: 0 });
    } finally { delete process.env.TICK_BUDGET_MS; process.env.IMMIGRATION_API_URL = prev.u; process.env.IMMIGRATION_API_TOKEN = prev.t; process.env.IMMIGRATION_API_FROM = prev.f; }
  });
});
