// The automation rules: what the system does by itself when time passes. Pure (no database): the admin page, the job and the tests share it.
export type RulesConfig = {
  payment_reminder: { enabled: boolean; after_hours: number };       // an unpaid application is left waiting: remind the traveler (once)
  unpaid_expire: { enabled: boolean; after_days: number };           // an unpaid application is too old, or its flight has already landed: close it ("expired")
  fix_reminder: { enabled: boolean; after_hours: number };           // Immigration / pre-check asked for a fix and the traveler has not answered: remind (once)
  sla_warning: { enabled: boolean; before_hours: number };           // staff: an application will miss its service deadline soon
  sla_overdue: { enabled: boolean };                                 // staff: an application is past its service deadline
  expiry_warning: { enabled: boolean; before_hours: number };        // an unpaid application will be closed soon: warn the traveler (once)
  flight_reminder: { enabled: boolean; before_hours: number };       // the flight to Thailand is near: remind (once; says what is still open)
  stay_guard: { enabled: boolean; stay_days: number };               // an approved traveler is inside the permitted stay: remind 7, 3 and 1 day before it ends
};
export const DEFAULT_RULES: RulesConfig = {
  payment_reminder: { enabled: true, after_hours: 24 },
  unpaid_expire: { enabled: true, after_days: 14 },
  fix_reminder: { enabled: true, after_hours: 24 },
  sla_warning: { enabled: true, before_hours: 6 },
  sla_overdue: { enabled: true },
  expiry_warning: { enabled: true, before_hours: 24 },
  flight_reminder: { enabled: true, before_hours: 48 },
  stay_guard: { enabled: true, stay_days: 15 },
};
const num = (v: unknown, d: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), min), max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
/** A damaged or missing setting means the defaults. */
export function parseRules(v: unknown): RulesConfig {
  const o = obj(v), d = DEFAULT_RULES;
  return {
    payment_reminder: { enabled: bool(obj(o.payment_reminder).enabled, d.payment_reminder.enabled), after_hours: num(obj(o.payment_reminder).after_hours, d.payment_reminder.after_hours, 1, 720) },
    unpaid_expire: { enabled: bool(obj(o.unpaid_expire).enabled, d.unpaid_expire.enabled), after_days: num(obj(o.unpaid_expire).after_days, d.unpaid_expire.after_days, 1, 180) },
    fix_reminder: { enabled: bool(obj(o.fix_reminder).enabled, d.fix_reminder.enabled), after_hours: num(obj(o.fix_reminder).after_hours, d.fix_reminder.after_hours, 1, 720) },
    sla_warning: { enabled: bool(obj(o.sla_warning).enabled, d.sla_warning.enabled), before_hours: num(obj(o.sla_warning).before_hours, d.sla_warning.before_hours, 1, 72) },
    sla_overdue: { enabled: bool(obj(o.sla_overdue).enabled, d.sla_overdue.enabled) },
    expiry_warning: { enabled: bool(obj(o.expiry_warning).enabled, d.expiry_warning.enabled), before_hours: num(obj(o.expiry_warning).before_hours, d.expiry_warning.before_hours, 1, 168) },
    flight_reminder: { enabled: bool(obj(o.flight_reminder).enabled, d.flight_reminder.enabled), before_hours: num(obj(o.flight_reminder).before_hours, d.flight_reminder.before_hours, 1, 168) },
    stay_guard: { enabled: bool(obj(o.stay_guard).enabled, d.stay_guard.enabled), stay_days: num(obj(o.stay_guard).stay_days, d.stay_guard.stay_days, 1, 90) },
  };
}

const HOUR = 3_600_000, DAY = 24 * HOUR;
const age = (iso: string | null | undefined, now: Date) => (iso ? now.getTime() - Date.parse(iso) : 0);

/** The application is unpaid and has waited long enough for a reminder (and its trip is still ahead). */
export const needsPaymentReminder = (a: { status: string; updated_at: string }, arrivalDate: string | null, cfg: RulesConfig, now: Date) =>
  cfg.payment_reminder.enabled && (a.status === "draft" || a.status === "awaiting_payment") && age(a.updated_at, now) >= cfg.payment_reminder.after_hours * HOUR && !(arrivalDate && arrivalDate < thaiToday(now));
/** The unpaid application is older than the limit, or the flight has already landed. */
export const shouldExpire = (a: { status: string; created_at: string }, arrivalDate: string | null, cfg: RulesConfig, now: Date) =>
  cfg.unpaid_expire.enabled && (a.status === "draft" || a.status === "awaiting_payment") && (age(a.created_at, now) >= cfg.unpaid_expire.after_days * DAY || !!(arrivalDate && arrivalDate < thaiToday(now)));
export const needsFixReminder = (a: { status: string; updated_at: string }, cfg: RulesConfig, now: Date) =>
  cfg.fix_reminder.enabled && a.status === "action_required" && age(a.updated_at, now) >= cfg.fix_reminder.after_hours * HOUR;
/** "warn" = due within the warning window, "late" = past due, null = nothing to say. */
export function slaLevel(slaDueAt: string | null, cfg: RulesConfig, now: Date): "warn" | "late" | null {
  if (!slaDueAt) return null;
  const left = Date.parse(slaDueAt) - now.getTime();
  if (left < 0) return cfg.sla_overdue.enabled ? "late" : null;
  return cfg.sla_warning.enabled && left <= cfg.sla_warning.before_hours * HOUR ? "warn" : null;
}
export const hoursLeft = (slaDueAt: string, now: Date) => Math.max(Math.round((Date.parse(slaDueAt) - now.getTime()) / HOUR), 0);
const thaiToday = (now: Date) => new Date(now.getTime() + 7 * HOUR).toISOString().slice(0, 10);

// ---------------------------------------------------------------- reminders before a deadline
const OPEN = ["paid", "pre_check", "submitted", "under_review", "action_required", "submission_failed"];
/** When an unpaid application will be closed: the age limit, or the end of the arrival day, whichever comes first (the same two reasons `shouldExpire` uses). */
export function expiresAt(createdAt: string, arrivalDate: string | null, cfg: RulesConfig): number {
  const byAge = Date.parse(createdAt) + cfg.unpaid_expire.after_days * DAY;
  const byFlight = arrivalDate ? Date.parse(`${arrivalDate}T00:00:00+07:00`) + DAY : Infinity;
  return Math.min(byAge, byFlight);
}
/** An unpaid application that will be closed within the warning window (and is not closed yet). */
export const needsExpiryWarning = (a: { status: string; created_at: string }, arrivalDate: string | null, cfg: RulesConfig, now: Date) => {
  if (!cfg.expiry_warning.enabled || !cfg.unpaid_expire.enabled || !(a.status === "draft" || a.status === "awaiting_payment")) return false;
  const left = expiresAt(a.created_at, arrivalDate, cfg) - now.getTime();
  return left > 0 && left <= cfg.expiry_warning.before_hours * HOUR;
};
export const hoursUntil = (ms: number, now: Date) => Math.max(Math.round((ms - now.getTime()) / HOUR), 1);

/** "approved" = a granted pass and the flight is near; "pending" = the flight is near but the decision is not there yet; null = nothing to say. */
export function flightLevel(status: string, trip: { arrival_date: string | null; arrival_time: string | null }, cfg: RulesConfig, now: Date): { level: "approved" | "pending"; hours: number } | null {
  if (!cfg.flight_reminder.enabled || !trip.arrival_date) return null;
  const at = Date.parse(`${trip.arrival_date}T${/^\d{2}:\d{2}/.test(trip.arrival_time ?? "") ? (trip.arrival_time as string).slice(0, 5) : "00:00"}:00+07:00`);
  const left = at - now.getTime();
  if (!Number.isFinite(left) || left <= 0 || left > cfg.flight_reminder.before_hours * HOUR) return null;
  const hours = hoursUntil(at, now);
  return status === "approved" ? { level: "approved", hours } : OPEN.includes(status) ? { level: "pending", hours } : null;
}

// ---------------------------------------------------------------- Stay Guard
/**
 * The last permitted day of a stay: the arrival day counts as day 1, so a 15-day stay that starts on the 1st ends on the 15th.
 * This is an estimate from the planned arrival date; the stamp in the passport is what counts, and the screens say so.
 */
export function stayEnd(arrivalDate: string, stayDays: number): string {
  const d = new Date(`${arrivalDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + stayDays - 1);
  return d.toISOString().slice(0, 10);
}
/** Whole days from today (Thai date) to the end date: 0 = last day, negative = past. */
export const daysLeft = (endDate: string, now: Date) => Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${thaiToday(now)}T00:00:00Z`)) / DAY);
export const STAY_MARKS = [7, 3, 1] as const;
/** The reminder to send today (one of 7, 3, 1 days left), or null. A missed day does not catch up on the day after: only the exact mark counts, each is sent once by its own key. */
export const stayMark = (endDate: string, now: Date): 7 | 3 | 1 | null => { const d = daysLeft(endDate, now); return (STAY_MARKS as readonly number[]).includes(d) ? (d as 7 | 3 | 1) : null; };
