// Family check-in rules. PURE: the screens, the timed job and the tests share them.
import { createHash, randomBytes } from "node:crypto";

export const MAX_CONTACTS = 5;
export const INTERVALS = [6, 12, 24, 48] as const;
export type Interval = (typeof INTERVALS)[number];
export type Schedule = { enabled: boolean; interval_hours: number; grace_hours: number; until_date: string | null; next_due_at: string | null; reminded_at: string | null; alerted_at: string | null };

/** The secret in a contact's link: 256 bits; only its hash is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
export const hashToken = (t: string) => createHash("sha256").update(`family:${t}`).digest("hex");

export const validEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 160 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(v);
export const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 60) : "");
/** Rounded to about 100 m, and only a real position on Earth. */
export function roundPos(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = Number(lat), b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: Math.round(a * 1000) / 1000, lon: Math.round(b * 1000) / 1000 };
}

const HOUR = 3_600_000;
/** After a check-in the next one is due `interval` hours later. */
export const nextDue = (from: Date, intervalHours: number) => new Date(from.getTime() + intervalHours * HOUR);
/** Thai calendar date (YYYY-MM-DD) of an instant: the "until" date is the traveler's trip date, counted in Thai time. */
export const thaiDate = (d: Date) => new Date(d.getTime() + 7 * HOUR).toISOString().slice(0, 10);
/** Whether the schedule is still running at `now` (switched on, and before the end of its last day). */
export const running = (s: Pick<Schedule, "enabled" | "until_date">, now: Date) => s.enabled && (!s.until_date || thaiDate(now) <= s.until_date);

export type Step = "none" | "remind" | "alert";
/**
 * What the timed job should do for one schedule right now.
 *  - "remind": the check-in is due and the traveler has not been reminded for this due time yet → a notice to the traveler.
 *  - "alert":  the check-in is overdue by more than the grace time and the contacts have not been told for this due time yet → a notice to the contacts.
 * Each is sent once per due time (reminded_at / alerted_at are compared with it), so running the job every few minutes never repeats it.
 */
export function nextStep(s: Schedule, now: Date): Step {
  if (!running(s, now) || !s.next_due_at) return "none";
  const due = Date.parse(s.next_due_at); if (!Number.isFinite(due)) return "none";
  const t = now.getTime();
  if (t >= due + s.grace_hours * HOUR && (!s.alerted_at || Date.parse(s.alerted_at) < due)) return "alert";
  if (t >= due && t < due + s.grace_hours * HOUR && (!s.reminded_at || Date.parse(s.reminded_at) < due)) return "remind";
  return "none";
}
/** A contact may be told only when they agreed, did not leave, and the link has not ended. */
export const canNotify = (c: { confirmed_at: string | null; revoked_at: string | null }) => !!c.confirmed_at && !c.revoked_at;
/** What a contact sees: ago text is built by the page; this only says how old the last check-in is, in whole hours. */
export const hoursAgo = (iso: string | null, now: Date) => (iso ? Math.max(Math.floor((now.getTime() - Date.parse(iso)) / HOUR), 0) : null);
/** How long a contact's link keeps working after the schedule ends: 7 days, so a relative can still see "arrived safe". */
export const LINK_GRACE_DAYS = 7;
export function linkActive(c: { revoked_at: string | null }, s: Pick<Schedule, "until_date"> | null, now: Date): boolean {
  if (c.revoked_at) return false;
  if (!s?.until_date) return true;
  return Date.parse(`${s.until_date}T00:00:00+07:00`) + (LINK_GRACE_DAYS + 1) * 24 * HOUR > now.getTime();
}
