// Government / TAT statistics against the REAL Supabase project: counts only, small groups hidden, access limited. Everything created is removed at the end.
import { afterAll, describe, expect, it } from "vitest";
import { DICTS } from "@/lib/i18n/dict";
import { resolveRange } from "@/lib/revenue/range";
import { canViewTourism, loadReport } from "@/lib/tourism/service";
import { MIN_CELL, OTHER } from "@/lib/tourism/stats";
import { SB_ANON, SB_URL, admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

afterAll(async () => { const problems = await cleanupUsers(); if (problems.length) throw new Error(problems.join("; ")); }, 120_000);
// the status guard only allows real transitions; the test needs states without whole journeys, so it skips the guard for its own rows
const set = (id: string, status: string, extra = "") => sql(`set session_replication_role = replica; update public.applications set status = '${status}' ${extra} where id = '${id}'`);
const asViewer = (id: string | null, isAdmin = false) => ({ user: id ? ({ id } as never) : null, profile: null, isAdmin, isOwner: false, isReportViewer: false, role: isAdmin ? ("manager" as const) : null, caps: isAdmin ? (["ops", "finance", "content", "config", "audit"] as const) : [] });

describe("tourism statistics", () => {
  it("counts approved arrivals by arrival date, hides groups under five, and counts the funnel", async () => {
    const day = 420, apps: { id: string; date: string }[] = [];
    for (let i = 0; i < 6; i++) { const u = await makeUser(`tour-${i}`), d = await makeDraft(u, "APR", { days: day }); const date = (await admin.from("trips").select("arrival_date").eq("id", d.tripId).single()).data!.arrival_date as string; apps.push({ id: d.appId, date }); }
    const date = apps[0].date, range = resolveRange("custom", new Date(), date, date), t = DICTS.en;
    // 3 approved, 1 rejected, 1 paid, 1 still a draft → arrivals 3 (a group under five), received 5 (paid or later)
    for (const a of apps.slice(0, 3)) await set(a.id, "approved", ", submitted_at = now() - interval '6 hours', decided_at = now()");
    await set(apps[3].id, "rejected"); await set(apps[4].id, "paid");
    let r = await loadReport(range, t);
    expect(r).toMatchObject({ arrivals: 3, received: 5, approved: 3, rejected: 1 }); expect(r.approvalRate).toBe(75); expect(r.avgDecisionHours).toBe(6);
    expect(r.sections.nationality).toEqual([{ key: OTHER, label: t.tourism_other, n: null }]);                      // 3 people of one nationality are never shown as "3"
    expect(r.sections.airport.every((x) => x.n === null)).toBe(true);
    // two more approved → 5 of one nationality may be shown
    await set(apps[3].id, "used"); await set(apps[4].id, "approved");
    r = await loadReport(range, t);
    expect(r.arrivals).toBe(5); expect(r.sections.nationality).toHaveLength(1); expect(r.sections.nationality[0].n).toBe(5); expect(r.sections.nationality[0].n).toBeGreaterThanOrEqual(MIN_CELL);
    expect(r.sections.nationality[0].label).not.toBe(t.tourism_other); expect(r.daily).toEqual([{ k: date, n: 5 }]);
    expect(JSON.stringify(r)).not.toMatch(/Test|Traveler|T\d{6}/);                                                   // no names, no passport data anywhere in the report
  });
  it("opens for staff and for added report viewers only; a viewer can be removed again", async () => {
    const staff = await makeUser("tour-staff", { admin: true }), viewer = await makeUser("tour-viewer"), other = await makeUser("tour-other");
    expect(await canViewTourism(asViewer(null))).toBe(false); expect(await canViewTourism(asViewer(staff.id, true))).toBe(true);
    expect(await canViewTourism(asViewer(viewer.id))).toBe(false);
    await sql(`insert into public.report_viewers (user_id, added_by) values ('${viewer.id}', '${staff.id}')`);
    expect(await canViewTourism(asViewer(viewer.id))).toBe(true); expect(await canViewTourism(asViewer(other.id))).toBe(false);
    await sql(`delete from public.report_viewers where user_id = '${viewer.id}'`); expect(await canViewTourism(asViewer(viewer.id))).toBe(false);
  });
  it("the statistics function cannot be called from a browser, signed in or not", async () => {
    const u = await makeUser("tour-rpc", { admin: true }), { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
    expect((await anon.rpc("tourism_stats", { p_from: "2020-01-01", p_to: "2030-01-01" })).error).not.toBeNull();
    expect((await u.client.rpc("tourism_stats", { p_from: "2020-01-01", p_to: "2030-01-01" })).error).not.toBeNull();          // even staff go through the server, which checks who is asking
  });
});
