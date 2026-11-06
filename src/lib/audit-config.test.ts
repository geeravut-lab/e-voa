import { describe, expect, it } from "vitest";
import { AUDIT_CATEGORIES, categoryOf, DEFAULT_AUDIT_CONFIG, parseAuditConfig, shouldRecord } from "./audit-config";

describe("audit configuration", () => {
  it("every action used in the app belongs to a group", () => {
    for (const a of ["auth.login", "payment.paid", "partner.package.create", "trip.change", "traveler.delete", "consent.recorded", "precheck.failed", "documents.purge", "feature.flags", "brand.name", "settings.audit", "ops.note", "agency.member.add", "channel.link", "invoice.issue", "addon.issue", "immigration.callback.rejected", "document.view", "application.cancel"]) expect(categoryOf(a), a).not.toBeNull();
    expect(categoryOf("something.new")).toBeNull();
    expect(AUDIT_CATEGORIES.length).toBe(new Set(AUDIT_CATEGORIES.map((c) => c.id)).size);
  });
  it("records everything by default; the master switch and groups turn recording off", () => {
    expect(shouldRecord("payment.paid", DEFAULT_AUDIT_CONFIG)).toBe(true);
    expect(shouldRecord("payment.paid", { enabled: false, disabled: [] })).toBe(false);
    expect(shouldRecord("payment.paid", { enabled: true, disabled: ["payment"] })).toBe(false);
    expect(shouldRecord("auth.login", { enabled: true, disabled: ["payment"] })).toBe(true);
    expect(shouldRecord("something.new", { enabled: true, disabled: ["payment"] })).toBe(true);        // unknown events are never lost silently
  });
  it("the record of a rule change is kept even when recording is off", () => {
    expect(shouldRecord("settings.audit", { enabled: false, disabled: ["settings"] }, true)).toBe(true);
  });
  it("a damaged setting falls back to recording everything", () => {
    expect(parseAuditConfig(null)).toEqual(DEFAULT_AUDIT_CONFIG);
    expect(parseAuditConfig({ enabled: "no", disabled: ["payment", "bogus", 3] })).toEqual({ enabled: true, disabled: ["payment"] });
  });
});
