import { describe, expect, it } from "vitest";
import { buildStatement, commissionOf, statementCsv, statementNo } from "./statement";

describe("agency statement", () => {
  const rows = [
    { date: "2026-11-05", reference: "EV-26-000002", traveler: "Test B", package: "express", serviceFeeThb: 2400 },
    { date: "2026-11-02", reference: "EV-26-000001", traveler: "Test, A", package: "regular", serviceFeeThb: 500 },
    { date: "2026-11-02", reference: "EV-26-000003", traveler: "=cmd", package: "regular", serviceFeeThb: 333 },
  ];
  const s = buildStatement({ id: "abcd1234-0000-0000-0000-000000000000", name: "Test Travel Co", commissionPct: 10 }, "2026-11", rows);
  it("numbers the statement by month and agency", () => { expect(statementNo("2026-11", "abcd1234-0000")).toBe("AGS-202611-ABCD"); expect(s.statementNo).toBe("AGS-202611-ABCD"); });
  it("commission is on the service fee only and rounds down to the satang", () => { expect(commissionOf(333, 10)).toBe(33.3); expect(commissionOf(999, 3.33)).toBe(33.26); expect(commissionOf(500, 0)).toBe(0); });
  it("adds up and lists in date order", () => {
    expect(s.applications).toBe(3); expect(s.serviceFeesThb).toBe(3233); expect(s.commissionThb).toBe(323.3);
    expect(s.lines.map((l) => l.reference)).toEqual(["EV-26-000001", "EV-26-000003", "EV-26-000002"]);
  });
  it("the CSV quotes commas, blocks formulas and ends with the totals", () => {
    const lines = statementCsv(s).replace("﻿", "").trim().split("\n");
    expect(lines[0]).toBe("date,reference,traveler,package,service_fee_thb,commission_thb_10pct"); expect(lines[1]).toContain('"Test, A"'); expect(lines.some((l) => l.includes("'=cmd"))).toBe(true);
    expect(lines.at(-1)).toBe("TOTAL,AGS-202611-ABCD,,3,3233.00,323.30");
  });
});
