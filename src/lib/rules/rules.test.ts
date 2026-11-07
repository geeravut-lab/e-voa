import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, expiresAt, needsExpiryWarning, flightLevel, stayEnd, daysLeft, stayMark, needsFixReminder, needsPaymentReminder, parseRules, shouldExpire, slaLevel } from "./rules";

const NOW = new Date("2026-11-06T10:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("automation rules", () => {
  it("a damaged setting means the defaults; values are kept inside sensible limits", () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES);
    const p = parseRules({ payment_reminder: { enabled: false, after_hours: 99999 }, sla_warning: { before_hours: -5 }, unpaid_expire: { after_days: "x" } });
    expect(p.payment_reminder).toEqual({ enabled: false, after_hours: 720 }); expect(p.sla_warning.before_hours).toBe(1); expect(p.unpaid_expire.after_days).toBe(14);
  });
  it("payment reminder: only unpaid applications that waited long enough and whose flight is still ahead", () => {
    const c = DEFAULT_RULES;
    expect(needsPaymentReminder({ status: "draft", updated_at: ago(25) }, "2026-12-01", c, NOW)).toBe(true);
    expect(needsPaymentReminder({ status: "awaiting_payment", updated_at: ago(2) }, "2026-12-01", c, NOW)).toBe(false);
    expect(needsPaymentReminder({ status: "paid", updated_at: ago(99) }, "2026-12-01", c, NOW)).toBe(false);
    expect(needsPaymentReminder({ status: "draft", updated_at: ago(99) }, "2026-11-01", c, NOW)).toBe(false);          // already landed: no reminder
    expect(needsPaymentReminder({ status: "draft", updated_at: ago(99) }, "2026-12-01", { ...c, payment_reminder: { enabled: false, after_hours: 24 } }, NOW)).toBe(false);
  });
  it("expiry: too old, or the flight has landed; paid applications are never touched", () => {
    const c = DEFAULT_RULES;
    expect(shouldExpire({ status: "draft", created_at: ago(15 * 24) }, "2026-12-30", c, NOW)).toBe(true);
    expect(shouldExpire({ status: "draft", created_at: ago(24) }, "2026-12-30", c, NOW)).toBe(false);
    expect(shouldExpire({ status: "awaiting_payment", created_at: ago(24) }, "2026-11-05", c, NOW)).toBe(true);
    expect(shouldExpire({ status: "paid", created_at: ago(9999) }, "2026-11-01", c, NOW)).toBe(false);
    expect(shouldExpire({ status: "pre_check", created_at: ago(9999) }, "2026-11-01", c, NOW)).toBe(false);
  });
  it("fix reminder only for applications waiting on the traveler", () => {
    expect(needsFixReminder({ status: "action_required", updated_at: ago(30) }, DEFAULT_RULES, NOW)).toBe(true);
    expect(needsFixReminder({ status: "action_required", updated_at: ago(3) }, DEFAULT_RULES, NOW)).toBe(false);
    expect(needsFixReminder({ status: "under_review", updated_at: ago(300) }, DEFAULT_RULES, NOW)).toBe(false);
  });
  it("SLA: warn inside the window, late after the deadline, nothing otherwise", () => {
    const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
    expect(slaLevel(at(5), DEFAULT_RULES, NOW)).toBe("warn"); expect(slaLevel(at(20), DEFAULT_RULES, NOW)).toBeNull(); expect(slaLevel(at(-1), DEFAULT_RULES, NOW)).toBe("late"); expect(slaLevel(null, DEFAULT_RULES, NOW)).toBeNull();
    expect(slaLevel(at(-1), { ...DEFAULT_RULES, sla_overdue: { enabled: false } }, NOW)).toBeNull();
  });
});

describe("reminders before a deadline", () => {
  const C = DEFAULT_RULES;
  it("expiry warning: only inside the last 24 h before the application is closed, never for paid or already closed ones", () => {
    expect(needsExpiryWarning({ status: "draft", created_at: ago(14 * 24 - 10) }, "2026-12-30", C, NOW)).toBe(true);            // closes in 10 h
    expect(needsExpiryWarning({ status: "draft", created_at: ago(14 * 24 - 30) }, "2026-12-30", C, NOW)).toBe(false);           // 30 h left
    expect(needsExpiryWarning({ status: "draft", created_at: ago(15 * 24) }, "2026-12-30", C, NOW)).toBe(false);                // already due to be closed
    expect(needsExpiryWarning({ status: "paid", created_at: ago(14 * 24 - 1) }, "2026-12-30", C, NOW)).toBe(false);
    expect(needsExpiryWarning({ status: "awaiting_payment", created_at: ago(2) }, "2026-11-06", C, NOW)).toBe(true);           // the arrival day ends in ~14 h (Thai time)
    expect(needsExpiryWarning({ status: "draft", created_at: ago(14 * 24 - 10) }, null, { ...C, expiry_warning: { enabled: false, before_hours: 24 } }, NOW)).toBe(false);
    expect(needsExpiryWarning({ status: "draft", created_at: ago(14 * 24 - 10) }, null, { ...C, unpaid_expire: { enabled: false, after_days: 14 } }, NOW)).toBe(false);
  });
  it("expiresAt is the earlier of the age limit and the end of the arrival day (Thai time)", () => {
    expect(expiresAt("2026-11-01T00:00:00Z", null, C)).toBe(Date.parse("2026-11-15T00:00:00Z"));
    expect(expiresAt("2026-11-01T00:00:00Z", "2026-11-03", C)).toBe(Date.parse("2026-11-03T17:00:00Z"));                      // 04 Nov 00:00 +07
  });
  it("flight reminder: inside the window only; says what is still open", () => {
    const trip = (h: number) => { const d = new Date(NOW.getTime() + h * 3_600_000 + 7 * 3_600_000).toISOString(); return { arrival_date: d.slice(0, 10), arrival_time: d.slice(11, 16) }; };
    expect(flightLevel("approved", trip(30), C, NOW)).toEqual({ level: "approved", hours: 30 }); expect(flightLevel("under_review", trip(30), C, NOW)?.level).toBe("pending");
    expect(flightLevel("approved", trip(60), C, NOW)).toBeNull(); expect(flightLevel("approved", trip(-2), C, NOW)).toBeNull();
    expect(flightLevel("draft", trip(30), C, NOW)).toBeNull(); expect(flightLevel("cancelled", trip(30), C, NOW)).toBeNull();
    expect(flightLevel("approved", { arrival_date: null, arrival_time: null }, C, NOW)).toBeNull(); expect(flightLevel("approved", trip(30), { ...C, flight_reminder: { enabled: false, before_hours: 48 } }, NOW)).toBeNull();
    expect(flightLevel("approved", { arrival_date: "2026-11-08", arrival_time: null }, C, NOW)?.level).toBe("approved");           // no time known: start of the day
  });
  it("stay guard: the arrival day counts as day 1; only the 7, 3 and 1 day marks fire", () => {
    expect(stayEnd("2026-11-01", 15)).toBe("2026-11-15"); expect(stayEnd("2026-12-25", 15)).toBe("2027-01-08"); expect(stayEnd("2026-11-01", 1)).toBe("2026-11-01");
    expect(daysLeft("2026-11-13", NOW)).toBe(7); expect(daysLeft("2026-11-06", NOW)).toBe(0); expect(daysLeft("2026-11-05", NOW)).toBe(-1);
    expect(stayMark("2026-11-13", NOW)).toBe(7); expect(stayMark("2026-11-09", NOW)).toBe(3); expect(stayMark("2026-11-07", NOW)).toBe(1);
    expect(stayMark("2026-11-10", NOW)).toBeNull(); expect(stayMark("2026-11-06", NOW)).toBeNull(); expect(stayMark("2026-11-01", NOW)).toBeNull();
  });
  it("the new settings are kept inside sensible limits", () => {
    const p = parseRules({ expiry_warning: { before_hours: 99999 }, flight_reminder: { before_hours: 0, enabled: false }, stay_guard: { stay_days: 500 } });
    expect(p.expiry_warning.before_hours).toBe(168); expect(p.flight_reminder).toEqual({ enabled: false, before_hours: 1 }); expect(p.stay_guard.stay_days).toBe(90);
  });
});
