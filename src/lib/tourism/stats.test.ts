import { describe, expect, it } from "vitest";
import { MIN_CELL, OTHER, buildReport, parseStats, reportCsv, suppress } from "@/lib/tourism/stats";

const lab = (k: string) => (k === OTHER ? "Other" : `L${k}`);
describe("small groups are never shown on their own", () => {
  it("keeps groups of five or more, biggest first, and folds the rest into one 'other' row", () => {
    const r = suppress([{ k: "1", n: 30 }, { k: "2", n: 5 }, { k: "3", n: 4 }, { k: "4", n: 3 }], lab);
    expect(r).toEqual([{ key: "1", label: "L1", n: 30 }, { key: "2", label: "L2", n: 5 }, { key: OTHER, label: "Other", n: 7 }]);          // 4 + 3 merged = 7, no longer a single small group
  });
  it("shows '<5' for an 'other' that is still small, and the number once the merged groups reach five", () => {
    expect(suppress([{ k: "a", n: 2 }], lab)).toEqual([{ key: OTHER, label: "Other", n: null }]);
    expect(suppress([{ k: "a", n: 3 }, { k: "b", n: 4 }], lab)).toEqual([{ key: OTHER, label: "Other", n: 7 }]);
  });
  it("can keep only the biggest groups", () => {
    const r = suppress([{ k: "a", n: 50 }, { k: "b", n: 40 }, { k: "c", n: 30 }], lab, { top: 2 });
    expect(r.map((x) => [x.key, x.n])).toEqual([["a", 50], ["b", 40], [OTHER, 30]]);
  });
  it("drops empty groups and says nothing for no data", () => { expect(suppress([{ k: "a", n: 0 }], lab)).toEqual([]); expect(suppress([], lab)).toEqual([]); });
  it("never lets a single hidden group leak: one group of 1..4 becomes '<5', not its count", () => { for (let n = 1; n < MIN_CELL; n++) expect(suppress([{ k: "x", n }], lab)[0].n).toBeNull(); });
});

describe("report", () => {
  const raw = parseStats({ funnel: { approved: 80, used: 20, rejected: 10, submitted: 5 }, daily: [{ k: "2026-12-01", n: 60 }, { k: "2026-12-02", n: 40 }], nationality: [{ k: "5", n: 70 }, { k: "6", n: 2 }, { k: "null", n: 28 }],
    airport: [{ k: "1", n: 100 }], purpose: [], gender: [], age: [{ k: "18-29", n: 100 }], stay: [], package: [{ k: "regular", n: 100 }], avg_decision_hours: "6.5", avg_lead_days: null });
  const rep = buildReport(raw, { from: "2026-12-01", to: "2026-12-31" }, (s, k) => (k === OTHER ? "Other" : `${s}:${k}`));
  it("counts arrivals, the funnel and the approval rate", () => {
    expect(rep).toMatchObject({ arrivals: 100, received: 115, approved: 100, rejected: 10, approvalRate: 90.9, avgDecisionHours: 6.5, avgLeadDays: null });
  });
  it("hides the group of two", () => { expect(rep.sections.nationality.map((r) => r.n)).toEqual([70, 28, null]); });
  it("exports what the page shows, with '<5' for hidden groups and quoted labels", () => {
    const csv = reportCsv(rep, (s) => s), lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("section,label,count"); expect(lines).toContain("arrivals,total,100"); expect(lines).toContain("daily,2026-12-01,60"); expect(lines).toContain('"nationality","Other",<5');
    expect(csv).not.toMatch(/,2\r?\n/);                                                                                                    // the real small count never appears
  });
  it("a damaged answer becomes zeros", () => {
    const z = parseStats("nope"); expect(z).toMatchObject({ funnel: {}, daily: [], avgDecisionHours: null }); expect(buildReport(z, { from: "a", to: "b" }, () => "").approvalRate).toBeNull();
    expect(parseStats({ daily: [{ k: "d", n: -4 }, 5, null] }).daily).toEqual([{ k: "d", n: 0 }]);
  });
});
