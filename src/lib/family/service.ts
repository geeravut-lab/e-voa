import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { mailConfigured, renderMail, sendMail } from "@/lib/mailer";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { fam, famText } from "./text";
import { INTERVALS, MAX_CONTACTS, canNotify, cleanName, hashToken, linkActive, newToken, nextDue, nextStep, roundPos, running, thaiDate, validEmail, validToken, type Schedule } from "./rules";

const db = () => createAdminClient();
export const familyLink = (token: string) => `${SITE_URL}/family/${token}`;
const fmtTime = (iso: string | Date) => new Date(typeof iso === "string" ? Date.parse(iso) : iso.getTime()).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export type Contact = { id: string; name: string; email: string; lang: string; invited_at: string; confirmed_at: string | null; revoked_at: string | null };
export type Checkin = { id: string; at: string; status: "safe" | "help" };

async function ownerFirstName(userId: string): Promise<{ name: string; lang: Lang }> {
  const { data } = await db().from("profiles").select("display_name, email, lang").eq("id", userId).maybeSingle();
  const first = (data?.display_name as string | null)?.trim().split(/\s+/)[0] || (data?.email as string | null)?.split("@")[0] || "";
  return { name: first || "A traveler", lang: isLang(data?.lang) ? data.lang : "en" };
}

export async function loadOwnerState(userId: string): Promise<{ contacts: Contact[]; schedule: Schedule | null; checkins: Checkin[] }> {
  const [c, s, h] = await Promise.all([
    db().from("safety_contacts").select("id, name, email, lang, invited_at, confirmed_at, revoked_at").eq("owner_id", userId).is("revoked_at", null).order("created_at"),
    db().from("safety_schedule").select("enabled, interval_hours, grace_hours, until_date, next_due_at, reminded_at, alerted_at").eq("owner_id", userId).maybeSingle(),
    db().from("safety_checkins").select("id, at, status").eq("owner_id", userId).order("at", { ascending: false }).limit(10),
  ]);
  return { contacts: (c.data ?? []) as Contact[], schedule: (s.data as Schedule | null) ?? null, checkins: (h.data ?? []) as Checkin[] };
}

/** Sends one message to a contact in the contact's language. False when e-mail is not set up or sending failed. */
async function mailContact(c: { email: string; lang: string; token?: string }, kind: string, subject: string, lines: string[], lang: Lang, ownerName: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  const t = famText(lang);
  const { html, text } = renderMail({ brand: "ThaiPass e-VOA", title: subject, lines, button: c.token ? { text: t.m_open, url: familyLink(c.token) } : undefined, footer: fam(t.m_footer, { name: ownerName }) });          // only the invitation carries the secret link; alerts need none
  return sendMail({ to: c.email, subject, html, text, kind });
}
const langOf = (c: { lang: string }): Lang => (isLang(c.lang) ? c.lang : "en");

// ---------------------------------------------------------------- contacts
export async function inviteContact(userId: string, input: { name: unknown; email: unknown; lang: unknown }): Promise<{ ok: true; link: string; mailed: boolean } | { ok: false; error: string }> {
  const name = cleanName(input.name), email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "", lang = isLang(input.lang) ? input.lang : "en";
  if (!name) return { ok: false, error: "err_form_incomplete" };
  if (!validEmail(email)) return { ok: false, error: "err_family_email" };
  const { data: have } = await db().from("safety_contacts").select("id, email").eq("owner_id", userId).is("revoked_at", null);
  if ((have ?? []).length >= MAX_CONTACTS) return { ok: false, error: "err_family_limit" };
  if ((have ?? []).some((c) => (c.email as string).toLowerCase() === email)) return { ok: false, error: "err_family_dup" };
  const token = newToken();
  const ins = await db().from("safety_contacts").insert({ owner_id: userId, name, email, lang, token_hash: hashToken(token) }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  const owner = await ownerFirstName(userId), t = famText(lang);
  const mailed = await mailContact({ email, lang, token }, "family_invite", fam(t.m_invite_subject, { name: owner.name }), [fam(t.m_invite_body, { name: owner.name })], lang, owner.name);
  await audit({ actorId: userId, action: "family.invite", entity: "safety_contact", entityId: ins.data[0].id as string });
  return { ok: true, link: familyLink(token), mailed };
}
/** A new secret link for a contact (the old one stops working), and a new invitation. The link is returned once. */
export async function resendInvite(userId: string, contactId: string): Promise<{ ok: true; link: string; mailed: boolean } | { ok: false; error: string }> {
  const { data: c } = await db().from("safety_contacts").select("id, email, lang").eq("id", contactId).eq("owner_id", userId).is("revoked_at", null).maybeSingle();
  if (!c) return { ok: false, error: "err_generic" };
  const token = newToken();
  const upd = await db().from("safety_contacts").update({ token_hash: hashToken(token), invited_at: new Date().toISOString(), confirmed_at: null }).eq("id", contactId).eq("owner_id", userId).select("id");
  if (upd.error || upd.data?.length !== 1) return { ok: false, error: "err_generic" };
  const owner = await ownerFirstName(userId), lang = langOf(c), t = famText(lang);
  const mailed = await mailContact({ email: c.email as string, lang: c.lang as string, token }, "family_invite", fam(t.m_invite_subject, { name: owner.name }), [fam(t.m_invite_body, { name: owner.name })], lang, owner.name);
  return { ok: true, link: familyLink(token), mailed };
}
export async function removeContact(userId: string, contactId: string): Promise<boolean> {
  const r = await db().from("safety_contacts").update({ revoked_at: new Date().toISOString() }).eq("id", contactId).eq("owner_id", userId).is("revoked_at", null).select("id");
  if (!r.error && (r.data?.length ?? 0) === 1) { await audit({ actorId: userId, action: "family.remove", entity: "safety_contact", entityId: contactId }); return true; }
  return false;
}

// ---------------------------------------------------------------- schedule
export async function saveSchedule(userId: string, input: { enabled: boolean; interval: unknown; grace: unknown; until: unknown }, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const interval = Number(input.interval), grace = Number(input.grace), until = typeof input.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.until) ? input.until : null;
  if (!(INTERVALS as readonly number[]).includes(interval) || !Number.isInteger(grace) || grace < 1 || grace > 12) return { ok: false, error: "err_form_incomplete" };
  if (input.enabled && until && until < thaiDate(now)) return { ok: false, error: "err_family_until" };
  const { data: cur } = await db().from("safety_schedule").select("enabled, interval_hours, next_due_at").eq("owner_id", userId).maybeSingle();
  const { data: last } = await db().from("safety_checkins").select("at").eq("owner_id", userId).order("at", { ascending: false }).limit(1);
  const base = last?.[0]?.at && Date.parse(last[0].at as string) > now.getTime() - interval * 3_600_000 ? new Date(last[0].at as string) : now;          // a recent check-in counts
  const restart = input.enabled && (!cur?.enabled || cur.interval_hours !== interval || !cur.next_due_at);
  const row = { owner_id: userId, enabled: input.enabled, interval_hours: interval, grace_hours: grace, until_date: until, updated_at: now.toISOString(), ...(restart ? { next_due_at: nextDue(base, interval).toISOString(), reminded_at: null, alerted_at: null } : {}), ...(!input.enabled ? { next_due_at: null, reminded_at: null, alerted_at: null } : {}) };
  const up = await db().from("safety_schedule").upsert(row, { onConflict: "owner_id" }).select("owner_id");
  return up.error || up.data?.length !== 1 ? { ok: false, error: "err_generic" } : { ok: true };
}

// ---------------------------------------------------------------- check-in
export type CheckInResult = { ok: true; told: number; contacts: number } | { ok: false; error: string };
/** "I am safe" or "I need help". A help check-in tells every accepted contact at once; a safe one only tells them when an alert had gone out ("all good now"). */
export async function checkIn(userId: string, status: "safe" | "help", pos: { lat: unknown; lon: unknown } | null, now = new Date()): Promise<CheckInResult> {
  const p = status === "help" && pos ? roundPos(pos.lat, pos.lon) : null;
  const ins = await db().from("safety_checkins").insert({ owner_id: userId, at: now.toISOString(), status, lat: p?.lat ?? null, lon: p?.lon ?? null }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  const { data: sch } = await db().from("safety_schedule").select("enabled, interval_hours, next_due_at, alerted_at").eq("owner_id", userId).maybeSingle();
  const wasAlerted = !!sch?.alerted_at && !!sch.next_due_at && Date.parse(sch.alerted_at as string) >= Date.parse(sch.next_due_at as string);
  if (sch?.enabled) await db().from("safety_schedule").update({ next_due_at: nextDue(now, sch.interval_hours as number).toISOString(), reminded_at: null, alerted_at: null }).eq("owner_id", userId);
  const { data: cs } = await db().from("safety_contacts").select("id, name, email, lang, confirmed_at, revoked_at").eq("owner_id", userId);
  const contacts = (cs ?? []).filter(canNotify);
  const owner = await ownerFirstName(userId);
  let told = 0;
  if (status === "help" || wasAlerted) for (const c of contacts) {
    await db().from("safety_contacts").update({ last_notified_at: now.toISOString() }).eq("id", c.id).eq("owner_id", userId);
    const lang = langOf(c as { lang: string }), t = famText(lang), when = fmtTime(now);
    const lines = status === "help" ? [fam(t.m_help_body, { name: owner.name, time: when }), ...(p ? [`${fam(t.m_help_pos, { pos: `${p.lat}, ${p.lon}` })} — ${t.m_pos_link}: https://www.google.com/maps?q=${p.lat},${p.lon}`] : [])] : [fam(t.m_back_body, { name: owner.name, time: when })];
    const subject = fam(status === "help" ? t.m_help_subject : t.m_back_subject, { name: owner.name });
    if (await mailContact({ email: c.email as string, lang: c.lang as string }, status === "help" ? "family_help" : "family_back", subject, lines, lang, owner.name)) told++;
  }
  await audit({ actorId: userId, action: status === "help" ? "family.help" : "family.safe", entity: "safety_checkin", entityId: ins.data[0].id as string, detail: { contacts: contacts.length, told } });
  return { ok: true, told, contacts: contacts.length };
}

// ---------------------------------------------------------------- the contact's page
export type ContactView =
  | { ok: false; state: "invalid" | "revoked" | "ended" }
  | { ok: true; state: "pending" | "active"; id: string; ownerName: string; lang: Lang; last: { at: string; status: "safe" | "help" } | null; overdue: boolean };
export async function loadContactView(token: unknown, now = new Date()): Promise<ContactView> {
  if (!validToken(token)) return { ok: false, state: "invalid" };
  const { data: c } = await db().from("safety_contacts").select("id, owner_id, lang, confirmed_at, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!c) return { ok: false, state: "invalid" };
  if (c.revoked_at) return { ok: false, state: "revoked" };
  const { data: sch } = await db().from("safety_schedule").select("enabled, interval_hours, grace_hours, until_date, next_due_at, reminded_at, alerted_at").eq("owner_id", c.owner_id).maybeSingle();
  if (!linkActive(c as { revoked_at: string | null }, sch as Schedule | null, now)) return { ok: false, state: "ended" };
  const owner = await ownerFirstName(c.owner_id as string);
  const { data: last } = await db().from("safety_checkins").select("at, status").eq("owner_id", c.owner_id).order("at", { ascending: false }).limit(1);
  const overdue = !!sch && running(sch as Schedule, now) && !!sch.next_due_at && Date.parse(sch.next_due_at as string) + (sch.grace_hours as number) * 3_600_000 <= now.getTime();
  return { ok: true, state: c.confirmed_at ? "active" : "pending", id: c.id as string, ownerName: owner.name, lang: isLang(c.lang) ? c.lang : owner.lang, last: last?.[0] ? { at: last[0].at as string, status: last[0].status as "safe" | "help" } : null, overdue };
}
export async function acceptContact(token: unknown): Promise<boolean> {
  if (!validToken(token)) return false;
  const r = await db().from("safety_contacts").update({ confirmed_at: new Date().toISOString() }).eq("token_hash", hashToken(token)).is("revoked_at", null).select("id");
  return !r.error && (r.data?.length ?? 0) === 1;
}
export async function leaveContact(token: unknown): Promise<boolean> {
  if (!validToken(token)) return false;
  const r = await db().from("safety_contacts").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(token)).is("revoked_at", null).select("id");
  return !r.error && (r.data?.length ?? 0) === 1;
}

// ---------------------------------------------------------------- the timed job
export type SafetyRun = { reminded: number; alerted: number; mailed: number };
/** Runs every few minutes: reminds travelers whose check-in is due, and tells contacts when it is overdue by more than the waiting time. Each step happens once per due time. */
export async function runSafetyJob(now = new Date(), opts: { onlyUsers?: string[] } = {}): Promise<SafetyRun> {
  const out: SafetyRun = { reminded: 0, alerted: 0, mailed: 0 };
  let q = db().from("safety_schedule").select("owner_id, enabled, interval_hours, grace_hours, until_date, next_due_at, reminded_at, alerted_at").eq("enabled", true).lte("next_due_at", now.toISOString()).limit(500);
  if (opts.onlyUsers) q = q.in("owner_id", opts.onlyUsers);
  const { data } = await q;
  for (const s of data ?? []) {
    const step = nextStep(s as Schedule, now); if (step === "none") continue;
    const owner = await ownerFirstName(s.owner_id as string), t = famText(owner.lang), due = s.next_due_at as string;
    if (step === "remind") {
      const r = await db().from("safety_schedule").update({ reminded_at: now.toISOString() }).eq("owner_id", s.owner_id).eq("next_due_at", due).select("owner_id");          // compare-and-set: one reminder per due time
      if (r.data?.length !== 1) continue;
      await notifyUser({ userId: s.owner_id as string, title: t.n_remind_title, body: fam(t.n_remind_body, { hours: s.grace_hours as number }), link: "/family", kind: "safety.remind", dedupeKey: `safety:remind:${s.owner_id}:${due}`, mail: false });
      out.reminded++; continue;
    }
    const r = await db().from("safety_schedule").update({ alerted_at: now.toISOString() }).eq("owner_id", s.owner_id).eq("next_due_at", due).select("owner_id");
    if (r.data?.length !== 1) continue;
    const { data: cs } = await db().from("safety_contacts").select("id, name, email, lang, confirmed_at, revoked_at").eq("owner_id", s.owner_id);
    const contacts = (cs ?? []).filter(canNotify);
    const { data: last } = await db().from("safety_checkins").select("at").eq("owner_id", s.owner_id).order("at", { ascending: false }).limit(1);
    let mailed = 0;
    for (const c of contacts) {
      await db().from("safety_contacts").update({ last_notified_at: now.toISOString() }).eq("id", c.id);
      const lang = langOf(c as { lang: string }), ct = famText(lang);
      if (await mailContact({ email: c.email as string, lang: c.lang as string }, "family_missed", fam(ct.m_missed_subject, { name: owner.name }), [fam(ct.m_missed_body, { name: owner.name, due: fmtTime(due), last: last?.[0]?.at ? fmtTime(last[0].at as string) : "—" })], lang, owner.name)) mailed++;
    }
    await notifyUser({ userId: s.owner_id as string, title: t.n_alert_title, body: fam(t.n_alert_body, { n: contacts.length }), link: "/family", kind: "safety.alerted", dedupeKey: `safety:alert:${s.owner_id}:${due}`, mail: false });
    out.alerted++; out.mailed += mailed;
  }
  return out;
}
