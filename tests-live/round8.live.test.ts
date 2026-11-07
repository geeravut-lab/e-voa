// Live checks for the 8 Nov round against the REAL Supabase project: staff roles, ops console (assign / bulk / saved filters), Web Push subscriptions,
// pay-later links, the new reminders. Everything created is removed at the end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { failPayment } from "@/lib/payments/service";
import { runRules } from "@/lib/rules/service";
import { assignApplications, deleteFilter, listAssignees, loadSavedFilters, runBulk, saveFilter } from "@/lib/ops/service";
import { DEFAULT_FILTER, parseFilter } from "@/lib/ops/filters";
import { removeSubscription, saveSubscription, hasSubscription, pushToUser } from "@/lib/push/service";
import { createPayLink, loadPayerView, payViaLink, revokePayLink } from "@/lib/paylink/service";
import { hashToken } from "@/lib/paylink/rules";
import { admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

const setStatus = (id: string, status: string) => sql(`set session_replication_role = replica; update public.applications set status = '${status}' where id = '${id}'`);
const thaiToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const nots = async (userId: string, key: string) => Number((await sql<{ n: number }>(`select count(*) n from public.app_notifications where user_id='${userId}' and dedupe_key='${key}'`))[0].n);
const paymentIds: string[] = [];

beforeAll(() => { process.env.STRIPE_SECRET_KEY = "proxy-injected"; });
afterAll(async () => {
  for (const id of paymentIds) await failPayment(id, "test cleanup").catch(() => undefined);
  const problems = await cleanupUsers();
  if (problems.length) throw new Error(`cleanup incomplete: ${problems.join("; ")}`);
}, 300_000);

describe("staff roles in the database", () => {
  it("a role is one of four, a change is recorded, and only the owner can add or remove staff", async () => {
    const staff = await makeUser("role-a", { admin: true }), target = await makeUser("role-t"), owner = await makeUser("role-o", { admin: true });
    expect((await sql<{ role: string }>(`select role from public.admins where user_id='${staff.id}'`))[0].role).toBe("manager");
    await expect(sql(`update public.admins set role = 'boss' where user_id='${staff.id}'`)).rejects.toThrow();
    await sql(`update public.admins set role = 'editor' where user_id='${staff.id}'`);
    expect(Number((await sql<{ n: number }>(`select count(*) n from public.audit_log where action='admin.role' and entity_id='${staff.id}'`))[0].n)).toBe(1);
    // a non-owner staff account cannot grant or revoke
    expect((await staff.client.rpc("grant_admin", { p_email: target.email, p_role: "operator" })).error?.message).toMatch(/err_forbidden/);
    expect((await staff.client.rpc("revoke_admin", { p_user: owner.id })).error?.message).toMatch(/err_forbidden/);
    // the owner can, with a role; an unknown role is refused; the owner row is never changed by a grant
    await sql(`update public.admins set is_owner = true where user_id='${owner.id}'`);
    expect((await owner.client.rpc("grant_admin", { p_email: target.email, p_role: "boss" })).error?.message).toMatch(/err_role_invalid/);
    expect((await owner.client.rpc("grant_admin", { p_email: target.email, p_role: "operator" })).error).toBeNull();
    expect((await sql<{ role: string }>(`select role from public.admins where user_id='${target.id}'`))[0].role).toBe("operator");
    expect((await owner.client.rpc("grant_admin", { p_email: owner.email, p_role: "editor" })).error).toBeNull();
    expect((await sql<{ role: string; is_owner: boolean }>(`select role, is_owner from public.admins where user_id='${owner.id}'`))[0]).toMatchObject({ role: "manager", is_owner: true });
    expect((await owner.client.rpc("revoke_admin", { p_user: owner.id })).error?.message).toMatch(/err_self_revoke/);
    expect((await owner.client.rpc("revoke_admin", { p_user: target.id })).error).toBeNull();
    expect(Number((await sql<{ n: number }>(`select count(*) n from public.admins where user_id='${target.id}'`))[0].n)).toBe(0);
  });
});

describe("ops console", () => {
  it("assigns, bulk-assigns, notes and un-assigns; only people whose role can work the queue are offered", async () => {
    const a = await makeUser("ops-a", { admin: true }), ed = await makeUser("ops-e", { admin: true }), u = await makeUser("ops-u");
    await sql(`update public.admins set role = 'editor' where user_id='${ed.id}'`);
    const d1 = await makeDraft(u, "OP1"), d2 = await makeDraft(u, "OP2");
    const people = await listAssignees();
    expect(people.map((p) => p.id)).toContain(a.id); expect(people.map((p) => p.id)).not.toContain(ed.id);
    expect(await assignApplications([d1.appId, d2.appId], a.id)).toBe(2);
    const who = async (id: string) => (await sql<{ assigned_to: string | null }>(`select assigned_to from public.applications where id='${id}'`))[0].assigned_to;
    expect(await who(d1.appId)).toBe(a.id);
    expect(await runBulk(a.id, { ids: [d1.appId, d2.appId], op: "unassign", assignee: null, note: "" })).toEqual({ done: 2, skipped: 0 }); expect(await who(d1.appId)).toBeNull();
    expect(await runBulk(a.id, { ids: [d1.appId], op: "assign_me", assignee: null, note: "" })).toEqual({ done: 1, skipped: 0 }); expect(await who(d1.appId)).toBe(a.id);
    expect(await runBulk(a.id, { ids: [d2.appId], op: "assign", assignee: ed.id, note: "" })).toEqual({ done: 0, skipped: 1 }); expect(await who(d2.appId)).toBeNull();      // an editor cannot work the queue
    expect(await runBulk(a.id, { ids: [d1.appId, d2.appId], op: "note", assignee: null, note: "call back" })).toEqual({ done: 2, skipped: 0 });
    expect(Number((await sql<{ n: number }>(`select count(*) n from public.application_notes where application_id in ('${d1.appId}','${d2.appId}') and body='call back'`))[0].n)).toBe(2);
    expect(await runBulk(a.id, { ids: [d1.appId], op: "retry", assignee: null, note: "" })).toEqual({ done: 0, skipped: 1 });                                                  // not in submission_failed: nothing changes
    expect(Number((await sql<{ n: number }>(`select count(*) n from public.audit_log where action like 'ops.bulk_%' and actor_id='${a.id}'`))[0].n)).toBeGreaterThanOrEqual(4);
  });
  it("saved filters belong to their owner, replace by name, are limited, and a stale one still parses", async () => {
    const a = await makeUser("flt-a", { admin: true }), b = await makeUser("flt-b", { admin: true });
    expect(await saveFilter(a.id, "  Late  express ", { ...DEFAULT_FILTER, g: "attention", p: "express", late: true })).toBe("ok");
    expect(await saveFilter(a.id, "Late express", { ...DEFAULT_FILTER, g: "all" })).toBe("ok");                       // same name: replaced, not duplicated
    const mine = await loadSavedFilters(a.id); expect(mine).toHaveLength(1); expect(mine[0].filter).toMatchObject({ g: "all", late: false });
    expect(await loadSavedFilters(b.id)).toEqual([]); expect(await deleteFilter(b.id, mine[0].id)).toBe(false); expect(await loadSavedFilters(a.id)).toHaveLength(1);
    expect(await saveFilter(a.id, "   ", DEFAULT_FILTER)).toBe("err_ops_filter_name");
    for (let i = 0; i < 19; i++) expect(await saveFilter(a.id, `F${i}`, DEFAULT_FILTER)).toBe("ok");
    expect(await saveFilter(a.id, "one too many", DEFAULT_FILTER)).toBe("err_ops_filter_limit");
    await sql(`update public.ops_saved_filters set query = '{"g":"nonsense","a":"<x>"}'::jsonb where user_id='${a.id}' and name='F0'`);
    expect((await loadSavedFilters(a.id)).find((f) => f.name === "F0")!.filter).toEqual(parseFilter({}));
    expect(await deleteFilter(a.id, mine[0].id)).toBe(true);
  });
});

describe("Web Push subscriptions", () => {
  it("keeps a well-formed subscription of a known push service, once per endpoint, and refuses everything else", async () => {
    const u = await makeUser("push-u"), v = await makeUser("push-v");
    const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: `B${"a".repeat(86)}`, auth: "x".repeat(22) } });
    const ep = `https://fcm.googleapis.com/fcm/send/${randomBytes(8).toString("hex")}`;
    expect(await saveSubscription(u.id, sub("https://evil.example.com/x"))).toBe(false); expect(await saveSubscription(u.id, { endpoint: ep })).toBe(false);
    expect(await hasSubscription(u.id)).toBe(false);
    expect(await saveSubscription(u.id, sub(ep))).toBe(true); expect(await saveSubscription(u.id, sub(ep))).toBe(true);
    expect(Number((await sql<{ n: number }>(`select count(*) n from public.push_subscriptions where endpoint='${ep}'`))[0].n)).toBe(1);
    expect(await hasSubscription(u.id)).toBe(true); expect(await hasSubscription(v.id)).toBe(false);
    expect(await pushToUser(u.id, { title: "x" })).toBe(0);                      // no VAPID keys here: nothing is sent, nothing throws
    await removeSubscription(v.id, ep); expect(await hasSubscription(u.id)).toBe(true);        // somebody else cannot remove it
    await removeSubscription(u.id, ep); expect(await hasSubscription(u.id)).toBe(false);
    const rls = await u.client.from("push_subscriptions").select("id"); expect(rls.data ?? []).toEqual([]);                          // the browser can read no one's endpoints
  });
});

describe("pay-later links", () => {
  it("a link shows the payer only first names and the price, a new link replaces the old one, and it can be stopped or expire", async () => {
    const u = await makeUser("pl-u"), d = await makeDraft(u, "PL1");
    const l1 = await createPayLink(u.id, d.tripId); if (!l1.ok) throw new Error(l1.error);
    expect((await sql<{ token_hash: string }>(`select token_hash from public.payment_links where trip_id='${d.tripId}' and revoked_at is null`))[0].token_hash).toBe(hashToken(l1.token));
    const v1 = await loadPayerView(l1.token); expect(v1.ok && v1.state).toBe("active");
    if (v1.ok) { expect(v1.payer.totalThb).toBeGreaterThan(0); expect(v1.payer.names).toEqual(["Test T."]); expect(JSON.stringify(v1)).not.toMatch(/passport|T\d{6}/i); }
    const l2 = await createPayLink(u.id, d.tripId); if (!l2.ok) throw new Error(l2.error);
    expect(await loadPayerView(l1.token)).toEqual({ ok: false, state: "revoked" }); expect((await loadPayerView(l2.token)).ok).toBe(true);
    expect(await loadPayerView("x".repeat(43))).toEqual({ ok: false, state: "invalid" }); expect(await loadPayerView("short")).toEqual({ ok: false, state: "invalid" });
    await sql(`update public.payment_links set expires_at = now() - interval '1 minute' where trip_id='${d.tripId}' and revoked_at is null`);
    expect(await loadPayerView(l2.token)).toEqual({ ok: false, state: "expired" });
    const l3 = await createPayLink(u.id, d.tripId); if (!l3.ok) throw new Error(l3.error);
    expect(await revokePayLink(u.id, d.tripId)).toBe(true); expect(await revokePayLink(u.id, d.tripId)).toBe(false); expect(await loadPayerView(l3.token)).toEqual({ ok: false, state: "revoked" });
    const other = await makeUser("pl-o"); expect((await createPayLink(other.id, d.tripId)).ok).toBe(false);                           // somebody else's trip
  });
  it("paying through a link starts the traveler's own checkout and returns to the public thank-you page", async () => {
    const u = await makeUser("pl-pay"), d = await makeDraft(u, "PL2");
    const l = await createPayLink(u.id, d.tripId); if (!l.ok) throw new Error(l.error);
    const r = await payViaLink(l.token, "en"); expect(r.ok).toBe(true);
    if (r.ok) {
      paymentIds.push(r.paymentId);
      expect(r.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      const p = (await sql<{ owner_id: string; status: string; trip_id: string }>(`select owner_id, status, trip_id from public.payments where id='${r.paymentId}'`))[0];
      expect(p).toMatchObject({ owner_id: u.id, status: "pending", trip_id: d.tripId });
      expect(Number((await sql<{ uses: number }>(`select uses from public.payment_links where trip_id='${d.tripId}' and revoked_at is null`))[0].uses)).toBe(1);
    }
    expect(await payViaLink("not-a-token", "en")).toEqual({ ok: false, error: "err_paylink_unavailable" });
    await revokePayLink(u.id, d.tripId); expect(await payViaLink(l.token, "en")).toEqual({ ok: false, error: "err_paylink_unavailable" });
  }, 120_000);
});

describe("new reminders", () => {
  it("unpaid application closing soon: one warning; flight near: one reminder; stay guard: only the 7/3/1 day marks, each once", async () => {
    const u = await makeUser("rm-u");
    // 1) an unpaid application that will be closed in about 10 hours
    const closing = await makeDraft(u, "RM1", { days: 40 });
    await sql(`set session_replication_role = replica; update public.applications set created_at = now() - interval '14 days' + interval '10 hours' where id='${closing.appId}'`);
    // 2) an approved application whose flight is in about 30 hours
    const flying = await makeDraft(u, "RM2");
    await setStatus(flying.appId, "approved");
    const soon = new Date(Date.now() + 30 * 3_600_000 + 7 * 3_600_000).toISOString();
    await sql(`update public.trips set arrival_date='${soon.slice(0, 10)}', arrival_time='${soon.slice(11, 16)}' where id='${flying.tripId}'`);
    // 3) an approved traveler whose 15-day stay has 7 days left (arrived 7 days ago)
    const staying = await makeDraft(u, "RM3");
    await setStatus(staying.appId, "approved");
    await sql(`update public.trips set arrival_date='${addDays(thaiToday(), -7)}', arrival_time='05:40' where id='${staying.tripId}'`);
    const r1 = await runRules(new Date(), { onlyOwners: [u.id], adminIds: [] });
    expect(r1.expiry_warnings).toBe(1); expect(r1.flight_reminders).toBe(1); expect(r1.stay_reminders).toBe(1);
    expect(await nots(u.id, `rule:expwarn:${closing.appId}`)).toBe(1); expect(await nots(u.id, `rule:flight:${flying.appId}:approved`)).toBe(1); expect(await nots(u.id, `rule:stay:${staying.appId}:7`)).toBe(1);
    const body = (await sql<{ body: string; link: string }>(`select body, link from public.app_notifications where user_id='${u.id}' and dedupe_key='rule:stay:${staying.appId}:7'`))[0];
    expect(body.link).toBe("/stay"); expect(body.body).toContain(addDays(thaiToday(), 7));
    const r2 = await runRules(new Date(), { onlyOwners: [u.id], adminIds: [] });
    expect(r2.expiry_warnings).toBe(0); expect(r2.flight_reminders).toBe(0); expect(r2.stay_reminders).toBe(0);                  // nothing is sent twice
    // a stay with 5 days left is not one of the marks
    await sql(`update public.trips set arrival_date='${addDays(thaiToday(), -9)}' where id='${staying.tripId}'`);
    expect((await runRules(new Date(), { onlyOwners: [u.id], adminIds: [] })).stay_reminders).toBe(0);
    // a pending application with the flight near gets the "no decision yet" message instead
    const waiting = await makeDraft(u, "RM4"); await setStatus(waiting.appId, "under_review");
    await sql(`update public.trips set arrival_date='${soon.slice(0, 10)}', arrival_time='${soon.slice(11, 16)}' where id='${waiting.tripId}'`);
    expect((await runRules(new Date(), { onlyOwners: [u.id], adminIds: [] })).flight_reminders).toBe(1); expect(await nots(u.id, `rule:flight:${waiting.appId}:pending`)).toBe(1);
  }, 240_000);
});
void admin;
