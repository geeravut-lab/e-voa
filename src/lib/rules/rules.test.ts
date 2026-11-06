import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, needsFixReminder, needsPaymentReminder, parseRules, shouldExpire, slaLevel } from "./rules";

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
