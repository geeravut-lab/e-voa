import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveDocument } from "@/lib/documents";
import { loadMasters } from "@/lib/master";
import { upsertTraveler } from "@/lib/applications/service";
import { audit } from "@/lib/audit";
import { parseCsv, validateRows } from "./csv";
import { buildStatement, type Statement } from "./statement";
import { isPeriod, periodRange } from "@/lib/partner-portal/rules";
import { notifyUser } from "@/lib/notify";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";

const db = () => createAdminClient();
export type Agency = { id: string; name: string; status: "pending" | "active" | "suspended"; discount_thb: number; commission_pct: number; contact_email: string | null };

export async function isActiveMember(userId: string, agencyId: string): Promise<boolean> {
  const { data } = await db().from("agency_members").select("agency_id, agencies!inner(status)").eq("user_id", userId).eq("agency_id", agencyId).eq("agencies.status", "active").maybeSingle();
  return !!data;
}
/** The user's agency (one per person for now) with their role in it. */
export async function membershipOf(userId: string): Promise<{ agency: Agency; role: "owner" | "agent" } | null> {
  const { data } = await db().from("agency_members").select("role, agencies(id, name, status, discount_thb, commission_pct, contact_email)").eq("user_id", userId).limit(1).maybeSingle();
  const a = data?.agencies as unknown as Agency | null;
  return data && a ? { agency: a, role: data.role as "owner" | "agent" } : null;
}

const Apply = z.object({ name: z.string().trim().min(2).max(120), contact_name: z.string().trim().min(2).max(100), contact_email: z.string().trim().email().max(100), contact_phone: z.string().trim().min(5).max(30), country: z.string().trim().min(2).max(60), license_no: z.string().trim().max(60).default("") });

/** A company asks to become an agency: it starts as "pending" until staff approve it. The person who asks becomes its owner. The registration document is optional here and can be opened by staff only. */
export async function applyForAgency(userId: string, input: unknown, doc?: Uint8Array): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = Apply.safeParse(input); if (!p.success) return { ok: false, error: "err_form_incomplete" };
  if (await membershipOf(userId)) return { ok: false, error: "err_agency_exists" };
  const ins = await db().from("agencies").insert({ ...p.data, created_by: userId, status: "pending" }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, error: "err_generic" };
  const mem = await db().from("agency_members").insert({ agency_id: ins.data.id, user_id: userId, role: "owner" }).select("user_id");
  if (mem.error) { await db().from("agencies").delete().eq("id", ins.data.id); return { ok: false, error: "err_generic" }; }
  if (doc && doc.length) { const r = await saveDocument({ ownerId: userId, agencyId: ins.data.id, kind: "other", bytes: doc }); if (!r.ok) return r; }
  await audit({ actorId: userId, action: "agency.apply", entity: "agency", entityId: ins.data.id });
  return { ok: true, id: ins.data.id };
}

/** The owner adds a colleague who already has an account (they sign in once first). */
export async function addMember(ownerId: string, agencyId: string, emailRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await db().from("agency_members").select("role").eq("agency_id", agencyId).eq("user_id", ownerId).maybeSingle();
  if (me.data?.role !== "owner") return { ok: false, error: "err_forbidden" };
  const email = emailRaw.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "err_email_invalid" };
  const { data: prof } = await db().from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!prof) return { ok: false, error: "err_agency_no_account" };
  if (await membershipOf(prof.id)) return { ok: false, error: "err_agency_exists" };
  const ins = await db().from("agency_members").insert({ agency_id: agencyId, user_id: prof.id, role: "agent" }).select("user_id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: ownerId, action: "agency.member.add", entity: "agency", entityId: agencyId });
  return { ok: true };
}
export async function removeMember(ownerId: string, agencyId: string, userId: string): Promise<boolean> {
  const me = await db().from("agency_members").select("role").eq("agency_id", agencyId).eq("user_id", ownerId).maybeSingle();
  if (me.data?.role !== "owner" || userId === ownerId) return false;
  const del = await db().from("agency_members").delete().eq("agency_id", agencyId).eq("user_id", userId).select("user_id");
  if (del.data?.length) await audit({ actorId: ownerId, action: "agency.member.remove", entity: "agency", entityId: agencyId });
  return (del.data?.length ?? 0) > 0;
}
export async function membersOf(agencyId: string) {
  const { data } = await db().from("agency_members").select("user_id, role, created_at").eq("agency_id", agencyId).order("created_at");
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: profs } = ids.length ? await db().from("profiles").select("id, email, display_name").in("id", ids) : { data: [] };
  return (data ?? []).map((m) => ({ ...m, email: profs?.find((p) => p.id === m.user_id)?.email ?? "", name: profs?.find((p) => p.id === m.user_id)?.display_name ?? "" }));
}

const COUNTED = ["paid", "pre_check", "action_required", "submitted", "submission_failed", "under_review", "approved", "used"];
/** Applications of an agency in a month, the service fees earned on them (after the agency's own discount) and the commission due. The visa fee is never commissionable. */
export async function agencyStats(agencyId: string, monthStart: Date) {
  const end = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const [{ data: ag }, { data: apps }] = await Promise.all([
    db().from("agencies").select("commission_pct").eq("id", agencyId).maybeSingle(),
    db().from("applications").select("id, status, service_fee_thb, created_at").eq("agency_id", agencyId).gte("created_at", monthStart.toISOString()).lt("created_at", end.toISOString()),
  ]);
  const paid = (apps ?? []).filter((a) => COUNTED.includes(a.status));
  const service = paid.reduce((s, a) => s + a.service_fee_thb, 0), pct = Number(ag?.commission_pct ?? 0);
  return { applications: apps?.length ?? 0, paid: paid.length, approved: (apps ?? []).filter((a) => a.status === "approved" || a.status === "used").length, serviceFeesThb: service, commissionPct: pct, commissionThb: Math.round(service * pct) / 100 };
}

/** Travelers from a CSV into the agent's traveler book (the same table the wizard uses). Rows that fail are reported; good rows are saved. */
export async function importTravelers(userId: string, text: string): Promise<{ created: number; updated: number; errors: { row: number; message: string }[]; fatal?: string }> {
  if (text.length > 300_000) return { created: 0, updated: 0, errors: [], fatal: "file too large" };
  const v = validateRows(parseCsv(text));
  if (v.fatal) return { created: 0, updated: 0, errors: [], fatal: v.fatal };
  const m = await loadMasters(["gender", "salutation", "nationality"]);
  const gender = (s: "M" | "F") => m.gender.find((g) => (s === "M" ? /^m/i : /^f/i).test(g.label))?.id;
  const salutation = (s: "M" | "F") => (s === "M" ? m.salutation.find((x) => /^mr\.?$/i.test(x.label)) : m.salutation.find((x) => /^(ms|miss)\.?$/i.test(x.label)))?.id ?? m.salutation[0]?.id;
  const nat = (code: string) => m.nationality.find((n) => String((n.extra as { CountryCode?: string }).CountryCode ?? "").toUpperCase() === code)?.id;
  let created = 0, updated = 0; const errors = [...v.errors];
  const { data: before } = await db().from("travelers").select("passport_no_hash").eq("owner_id", userId);
  const have = new Set((before ?? []).map((b) => b.passport_no_hash));
  const { hashId } = await import("@/lib/crypto");
  for (const [i, t] of v.ok.entries()) {
    const row = i + 2, gid = gender(t.sex), nid = nat(t.nationality), sid = salutation(t.sex);
    if (!gid || !sid) { errors.push({ row, message: "the reference lists are not loaded" }); continue; }
    if (!nid) { errors.push({ row, message: `nationality ${t.nationality} is not in the list` }); continue; }
    const r = await upsertTraveler(userId, { relation: "client", given_name: t.given_name, middle_name: t.middle_name || null, surname: t.surname, gender_id: gid, salutation_id: sid, date_of_birth: t.date_of_birth, nationality_id: nid, passport_no: t.passport_no,
      passport_issue_date: t.passport_issue_date, passport_expiry_date: t.passport_expiry_date, passport_place_of_issue: t.passport_place_of_issue, email: t.email, phone: t.phone });
    if (!r.ok) { errors.push({ row, message: r.error }); continue; }
    if (have.has(hashId(t.passport_no))) updated++; else created++;
  }
  errors.sort((a, b) => a.row - b.row);
  await audit({ actorId: userId, action: "agency.import", entity: "traveler", detail: { created, updated, errors: errors.length } });
  return { created, updated, errors };
}

// ------------------------------------------------------------------ statements and commission payouts
/** The statement of one month: applications of the agency created in that month (Thai time) that count (paid or later), their service fees and the commission. */
export async function loadStatement(agencyId: string, period: string): Promise<Statement | null> {
  if (!isPeriod(period)) return null;
  const { data: ag } = await db().from("agencies").select("id, name, commission_pct").eq("id", agencyId).maybeSingle();
  if (!ag) return null;
  const { from, to } = periodRange(period);
  const { data: apps } = await db().from("applications").select("ref_no, status, package, service_fee_thb, created_at, traveler_id").eq("agency_id", agencyId).in("status", COUNTED).gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).order("created_at");
  const ids = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const { data: trs } = ids.length ? await db().from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
  return buildStatement({ id: ag.id, name: ag.name, commissionPct: Number(ag.commission_pct) }, period, (apps ?? []).map((a) => { const t = trs?.find((x) => x.id === a.traveler_id); return { date: new Date(new Date(a.created_at).getTime() + 7 * 3_600_000).toISOString().slice(0, 10), reference: a.ref_no, traveler: t ? `${t.given_name} ${t.surname}` : "", package: a.package, serviceFeeThb: Number(a.service_fee_thb) }; }));
}
export async function payoutsOf(agencyId: string) {
  const { data } = await db().from("agency_payouts").select("period, statement_no, applications, commission_thb, paid_at").eq("agency_id", agencyId).order("period", { ascending: false }).limit(24);
  return (data ?? []).map((p) => ({ ...p, commission_thb: Number(p.commission_thb) }));
}

/** Staff record that the month's commission was paid to the agency. Once per month; the numbers are frozen as they were at that moment. */
export async function closePayout(adminId: string, agencyId: string, period: string, note: string): Promise<{ ok: true; commissionThb: number } | { ok: false; error: string }> {
  const st = await loadStatement(agencyId, period);
  if (!st) return { ok: false, error: "err_not_found" };
  if (st.applications === 0 || st.commissionThb <= 0) return { ok: false, error: "err_nothing_to_settle" };
  const ins = await db().from("agency_payouts").insert({ agency_id: agencyId, period, statement_no: st.statementNo, applications: st.applications, service_fees_thb: st.serviceFeesThb, commission_pct: st.commissionPct, commission_thb: st.commissionThb, paid_by: adminId, note: note.slice(0, 300) || null }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: ins.error?.code === "23505" ? "err_settled_already" : "err_generic" };
  await audit({ actorId: adminId, actorRole: "admin", action: "agency.payout", entity: "agency", entityId: agencyId, detail: { period, commission_thb: st.commissionThb, applications: st.applications } });
  const { data: mem } = await db().from("agency_members").select("user_id").eq("agency_id", agencyId);
  for (const m of mem ?? []) {
    const { data: prof } = await db().from("profiles").select("lang").eq("id", m.user_id).maybeSingle();
    const t = DICTS[isLang(prof?.lang) ? prof.lang : "en"];
    await notifyUser({ userId: m.user_id, title: t.agency_n_paid_title, body: fmt(t.agency_n_paid_body, { period, amount: st.commissionThb.toLocaleString("en-US"), no: st.statementNo }), link: "/agency", kind: "agency.payout", dedupeKey: `agency:payout:${agencyId}:${period}:${m.user_id}` });
  }
  return { ok: true, commissionThb: st.commissionThb };
}
