import { describe, expect, it } from "vitest";
import { NAV, spreadTones } from "./nav";

// Re-creates the 2-column placement to check which cards touch.
function cells(items: { key: string; size: "wide" | "half" }[]) {
  const at = new Map<string, [number, number][]>(); let row = 0, col = 0;
  for (const it of items) {
    if (it.size === "wide") { if (col) { row++; col = 0; } at.set(it.key, [[row, 0], [row, 1]]); row++; col = 0; }
    else { at.set(it.key, [[row, col]]); col++; if (col > 1) { row++; col = 0; } }
  }
  return at;
}
const touching = (a: [number, number][], b: [number, number][]) => a.some(([r, c]) => b.some(([r2, c2]) => Math.abs(r - r2) + Math.abs(c - c2) === 1));

describe("card colours", () => {
  for (const area of ["traveler", "admin"] as const) {
    it(`${area}: cards that touch never share a colour, and colours are used evenly`, () => {
      const items = NAV.filter((n) => n.home && n.area === area);
      const tones = spreadTones(items), at = cells(items);
      for (const a of items) for (const b of items) if (a.key < b.key && touching(at.get(a.key)!, at.get(b.key)!)) expect(tones.get(a.key), `${a.key} / ${b.key}`).not.toBe(tones.get(b.key));
      const count = new Map<string, number>(); for (const t of tones.values()) count.set(t, (count.get(t) ?? 0) + 1);
      expect(Math.max(...count.values()) - Math.min(...count.values())).toBeLessThanOrEqual(2);
    });
  }
});
