import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, slaHours, statusFromImmigration, statusFromImmigrationText, STATUSES, TRANSITIONS, travelerCanEdit } from "./state";

describe("application state machine", () => {
  it("every target is a known status", () => {
    for (const s of STATUSES) for (const t of TRANSITIONS[s]) expect(STATUSES).toContain(t);
  });
  it("happy path is allowed end to end", () => {
    const path = ["draft", "awaiting_payment", "paid", "pre_check", "submitted", "under_review", "approved", "used"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1]), `${path[i]}→${path[i + 1]}`).toBe(true);
  });
  it("cannot skip checks or reopen finished applications", () => {
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("awaiting_payment", "approved")).toBe(false);
    expect(canTransition("paid", "approved")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
    expect(canTransition("approved", "rejected")).toBe(false);
  });
  it("terminal states have no exits", () => {
    for (const s of ["expired", "rejected", "cancelled", "used", "no_show"] as const) expect(isTerminal(s)).toBe(true);
    expect(isTerminal("approved")).toBe(false);
  });
  it("a failed submission can be retried", () => expect(canTransition("submission_failed", "submitted")).toBe(true));
  it("maps Immigration status ids and texts", () => {
    expect(statusFromImmigration(1)).toBe("approved");
    expect(statusFromImmigration(2)).toBe("rejected");
    expect(statusFromImmigration(3)).toBe("action_required");
    expect(statusFromImmigration(9)).toBeNull();
    expect(statusFromImmigrationText("Pending")).toBe("under_review");
    expect(statusFromImmigrationText("NeedUpdate")).toBe("action_required");
    expect(statusFromImmigrationText("???")).toBeNull();
  });
  it("sla and editing rules", () => {
    expect(slaHours("express")).toBe(24);
    expect(slaHours("regular")).toBe(72);
    expect(travelerCanEdit("draft")).toBe(true);
    expect(travelerCanEdit("action_required")).toBe(true);
    expect(travelerCanEdit("under_review")).toBe(false);
  });
});
