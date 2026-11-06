// The automation rules: what the system does by itself when time passes. Pure (no database): the admin page, the job and the tests share it.
export type RulesConfig = {
  payment_reminder: { enabled: boolean; after_hours: number };       // an unpaid application is left waiting: remind the traveler (once)
  unpaid_expire: { enabled: boolean; after_days: number };           // an unpaid application is too old, or its flight has already landed: close it ("expired")
  fix_reminder: { enabled: boolean; after_hours: number };           // Immigration / pre-check asked for a fix and the traveler has not answered: remind (once)
  sla_warning: { enabled: boolean; before_hours: number };           // staff: an application will miss its service deadline soon
  sla_overdue: { enabled: boolean };                                 // staff: an application is past its service deadline
};
export const DEFAULT_RULES: RulesConfig = {
  payment_reminder: { enabled: true, after_hours: 24 },
  unpaid_expire: { enabled: true, after_days: 14 },
  fix_reminder: { enabled: true, after_hours: 24 },
  sla_warning: { enabled: true, before_hours: 6 },
  sla_overdue: { enabled: true },
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
