// Live checks of the family check-in against the real database, with a local fake of the e-mail service (Resend's HTTP API) so the messages can be read.
// Needs migration 20261127000100_family_checkin.sql applied. Throw-away users only; everything is deleted at the end.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptContact, checkIn, inviteContact, leaveContact, loadContactView, loadOwnerState, removeContact, resendInvite, runSafetyJob, saveSchedule } from "@/lib/family/service";
import { hashToken } from "@/lib/family/rules";
import { exportMyData, eraseAccount } from "@/lib/privacy/service";
import { admin, cleanupUsers, makeUser, sql } from "./helpers";

type Mail = { to: string[]; subject: string; text: string };
const sent: Mail[] = []; let fake: Server;
const tokenOf = (link: string) => link.split("/family/")[1];
const mailsTo = (addr: string) => sent.filter((m) => m.to.includes(addr));

beforeAll(async () => {
  fake = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { sent.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"id":"x"}'); }); });
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  const port = (fake.address() as { port: number }).port;
  Object.assign(process.env, { RESEND_API_KEY: "test-key", RESEND_API_URL: `http://127.0.0.1:${port}/emails`, MAIL_FROM: "Test <test@example.com>" });
}, 60_000);
afterAll(async () => { fake?.close(); const problems = await cleanupUsers(); if (problems.length) throw new Error(problems.join("; ")); }, 120_000);

describe("live family check-in", () => {
  it("the tables are closed to the browser: a signed-in user cannot read or write them directly", async () => {
    const u = await makeUser("fam-rls");
    for (const t of ["safety_contacts", "safety_checkins", "safety_schedule"]) {
      const r = await u.client.from(t).select("*"); expect(r.data ?? []).toEqual([]);
      const w = await u.client.from(t).insert({ owner_id: u.id }); expect(w.error).not.toBeNull();
    }
  });
  it("invites a person, who accepts through the secret link; only the hash of the link is stored", async () => {
    const u = await makeUser("fam-inv"); sent.length = 0;
    expect(await inviteContact(u.id, { name: "Mum", email: "nope", lang: "en" })).toEqual({ ok: false, error: "err_family_email" });
    const inv = await inviteContact(u.id, { name: "  Mum ", email: "Mum.Fam@Example.com", lang: "th" });
    expect(inv.ok && inv.mailed).toBe(true); if (!inv.ok) return;
    const token = tokenOf(inv.link);
    const mail = mailsTo("mum.fam@example.com")[0]; expect(mail.text).toContain(`/family/${token}`);
    expect(mail.subject).toMatch(/[ก-๙]/);                                           // sent in Thai
    const rows = await sql<{ token_hash: string }>(`select token_hash from public.safety_contacts where owner_id='${u.id}'`);
    expect(rows[0].token_hash).toBe(hashToken(token)); expect(JSON.stringify(rows)).not.toContain(token);
    expect(await inviteContact(u.id, { name: "Mum", email: "mum.fam@example.com", lang: "en" })).toEqual({ ok: false, error: "err_family_dup" });
    const v1 = await loadContactView(token); expect(v1).toMatchObject({ ok: true, state: "pending" });
    expect(await acceptContact(token)).toBe(true);
    expect(await loadContactView(token)).toMatchObject({ ok: true, state: "active", last: null });
    expect(await loadContactView("x".repeat(43))).toEqual({ ok: false, state: "invalid" });
    expect(await acceptContact("bad")).toBe(false);
    // a new link replaces the old one
    const again = await resendInvite(u.id, (await loadOwnerState(u.id)).contacts[0].id); expect(again.ok).toBe(true);
    expect(await loadContactView(token)).toEqual({ ok: false, state: "invalid" });
    if (again.ok) expect(await loadContactView(tokenOf(again.link))).toMatchObject({ ok: true, state: "pending" });
  });
  it("limits contacts to five and lets the person leave", async () => {
    const u = await makeUser("fam-lim"); const links: string[] = [];
    for (let i = 0; i < 5; i++) { const r = await inviteContact(u.id, { name: `P${i}`, email: `p${i}.${u.id.slice(0, 6)}@example.com`, lang: "en" }); expect(r.ok).toBe(true); if (r.ok) links.push(r.link); }
    expect(await inviteContact(u.id, { name: "Six", email: "six@example.com", lang: "en" })).toEqual({ ok: false, error: "err_family_limit" });
    const t = tokenOf(links[0]); expect(await leaveContact(t)).toBe(true); expect(await loadContactView(t)).toEqual({ ok: false, state: "revoked" });
    expect(await leaveContact(t)).toBe(false);                                         // second time matches no row
    expect((await loadOwnerState(u.id)).contacts).toHaveLength(4);
    expect(await removeContact(u.id, (await loadOwnerState(u.id)).contacts[0].id)).toBe(true);
    expect(await removeContact(u.id, "00000000-0000-0000-0000-000000000000")).toBe(false);
  });
  it("'I need help' tells accepted contacts only, with the position rounded; 'I am safe' stays quiet", async () => {
    const u = await makeUser("fam-help"); sent.length = 0;
    const a = await inviteContact(u.id, { name: "Agreed", email: `agreed.${u.id.slice(0, 6)}@example.com`, lang: "en" }), b = await inviteContact(u.id, { name: "Waiting", email: `waiting.${u.id.slice(0, 6)}@example.com`, lang: "en" });
    if (!a.ok || !b.ok) throw new Error("invite"); await acceptContact(tokenOf(a.link)); sent.length = 0;
    const safe = await checkIn(u.id, "safe", { lat: 13.1, lon: 100.1 }); expect(safe).toEqual({ ok: true, told: 0, contacts: 1 }); expect(sent).toHaveLength(0);
    const help = await checkIn(u.id, "help", { lat: 13.756331, lon: 100.501765 }); expect(help).toEqual({ ok: true, told: 1, contacts: 1 });
    expect(sent).toHaveLength(1); expect(sent[0].to[0]).toContain("agreed."); expect(sent[0].text).toContain("13.756, 100.502"); expect(sent[0].text).not.toContain("13.7563");
    const pos = await sql<{ status: string; lat: string | null }>(`select status, lat from public.safety_checkins where owner_id='${u.id}' order by at`);
    expect(pos.map((r) => [r.status, r.lat])).toEqual([["safe", null], ["help", "13.756"]]);            // a position is kept only for "help"
    expect(await loadContactView(tokenOf(a.link))).toMatchObject({ ok: true, state: "active", last: { status: "help" } });
  });
  it("a missed check-in: one reminder, then one alert to the contacts, never repeated; checking in afterwards says all is well", async () => {
    const u = await makeUser("fam-miss"); sent.length = 0;
    const a = await inviteContact(u.id, { name: "Dad", email: `dad.${u.id.slice(0, 6)}@example.com`, lang: "en" }); if (!a.ok) throw new Error("invite"); await acceptContact(tokenOf(a.link));
    const t0 = new Date(Date.now() - 30 * 3_600_000);
    expect((await saveSchedule(u.id, { enabled: true, interval: 12, grace: 2, until: null }, t0)).ok).toBe(true);        // first check-in was due 18 h ago
    expect(await saveSchedule(u.id, { enabled: true, interval: 7, grace: 2, until: null })).toEqual({ ok: false, error: "err_form_incomplete" });
    expect(await saveSchedule(u.id, { enabled: true, interval: 12, grace: 2, until: "2020-01-01" })).toEqual({ ok: false, error: "err_family_until" });
    sent.length = 0;
    // 12.5 h after the start: due, inside the waiting time → a reminder to the traveler only
    const remind = await runSafetyJob(new Date(t0.getTime() + 12.5 * 3_600_000), { onlyUsers: [u.id] }); expect(remind).toEqual({ reminded: 1, alerted: 0, mailed: 0 });
    expect((await runSafetyJob(new Date(t0.getTime() + 12.6 * 3_600_000), { onlyUsers: [u.id] })).reminded).toBe(0);
    expect(sent).toHaveLength(0);
    const alert = await runSafetyJob(new Date(t0.getTime() + 14.5 * 3_600_000), { onlyUsers: [u.id] }); expect(alert).toEqual({ reminded: 0, alerted: 1, mailed: 1 });
    expect(mailsTo(`dad.${u.id.slice(0, 6)}@example.com`)).toHaveLength(1);
    expect(await runSafetyJob(new Date(t0.getTime() + 20 * 3_600_000), { onlyUsers: [u.id] })).toEqual({ reminded: 0, alerted: 0, mailed: 0 });
    expect(await loadContactView(tokenOf(a.link), new Date(t0.getTime() + 20 * 3_600_000))).toMatchObject({ ok: true, overdue: true });
    sent.length = 0; const back = await checkIn(u.id, "safe", null); expect(back).toEqual({ ok: true, told: 1, contacts: 1 }); expect(sent[0].subject).toMatch(/all good/i);
    const st = (await loadOwnerState(u.id)).schedule!; expect(st.alerted_at).toBeNull(); expect(Date.parse(st.next_due_at!)).toBeGreaterThan(Date.now());
  });
  it("two jobs running at once send the alert only once", async () => {
    const u = await makeUser("fam-race"); sent.length = 0;
    const a = await inviteContact(u.id, { name: "Sis", email: `sis.${u.id.slice(0, 6)}@example.com`, lang: "en" }); if (!a.ok) throw new Error("invite"); await acceptContact(tokenOf(a.link));
    const t0 = new Date(Date.now() - 5 * 3_600_000); await saveSchedule(u.id, { enabled: true, interval: 6, grace: 1, until: null }, new Date(t0.getTime() - 0)); sent.length = 0;
    const when = new Date(t0.getTime() + 8 * 3_600_000);
    const r = await Promise.all([runSafetyJob(when, { onlyUsers: [u.id] }), runSafetyJob(when, { onlyUsers: [u.id] })]);
    expect(r.reduce((n, x) => n + x.alerted, 0)).toBe(1); expect(mailsTo(`sis.${u.id.slice(0, 6)}@example.com`)).toHaveLength(1);
  });
  it("my data download lists the family data, and erasing the account removes all of it", async () => {
    const u = await makeUser("fam-erase");
    const a = await inviteContact(u.id, { name: "Bro", email: `bro.${u.id.slice(0, 6)}@example.com`, lang: "en" }); if (!a.ok) throw new Error("invite");
    await checkIn(u.id, "help", { lat: 7.88, lon: 98.39 }); await saveSchedule(u.id, { enabled: true, interval: 24, grace: 2, until: null });
    const exp = (await exportMyData(u.id, u.email)).family_checkin as { contacts: unknown[]; checkins: unknown[]; schedule: unknown };
    expect(exp.contacts).toHaveLength(1); expect(exp.checkins).toHaveLength(1); expect(exp.schedule).not.toBeNull();
    expect((await eraseAccount(u.id)).ok).toBe(true);
    for (const t of ["safety_contacts", "safety_checkins", "safety_schedule"]) expect(Number((await sql<{ n: number }>(`select count(*) n from public.${t} where owner_id='${u.id}'`))[0].n)).toBe(0);
    void admin;
  });
});
