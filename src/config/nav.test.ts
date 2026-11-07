import { describe, expect, it } from "vitest";
import { NAV, packCards, spreadTones } from "./nav";

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
      const items = packCards(NAV.filter((n) => n.home && n.area === area && !n.viewerOnly));            // what everybody sees; the statistics shortcut is for report viewers only (next test)
      const tones = spreadTones(items), at = cells(items);
      for (const a of items) for (const b of items) if (a.key < b.key && touching(at.get(a.key)!, at.get(b.key)!)) expect(tones.get(a.key), `${a.key} / ${b.key}`).not.toBe(tones.get(b.key));
      const count = new Map<string, number>(); for (const t of tones.values()) count.set(t, (count.get(t) ?? 0) + 1);
      expect(Math.max(...count.values()) - Math.min(...count.values())).toBeLessThanOrEqual(2);
    });
  }
  it("traveler with the statistics shortcut for report viewers: touching cards still never share a colour", () => {
    const items = packCards(NAV.filter((n) => n.home && n.area === "traveler")), tones = spreadTones(items), at = cells(items);
    expect(items.some((n) => n.viewerOnly)).toBe(true);
    for (const a of items) for (const b of items) if (a.key < b.key && touching(at.get(a.key)!, at.get(b.key)!)) expect(tones.get(a.key), `${a.key} / ${b.key}`).not.toBe(tones.get(b.key));
  });
});

describe("travel articles card", () => {
  const trav = NAV.filter((n) => n.home && n.area === "traveler");
  it("sits right before notifications, in the sidebar too, and stays light blue whatever the layout", () => {
    const i = trav.findIndex((n) => n.key === "articles");
    expect(i).toBeGreaterThan(0); expect(trav[i + 1].key).toBe("notifications");
    expect(NAV.find((n) => n.key === "articles")).toMatchObject({ href: "/articles", tone: "sky", pin: true, side: true, auth: false });
    for (const set of [trav, trav.filter((n) => !["notifications", "account"].includes(n.key)), trav.filter((n) => !n.viewerOnly)]) {
      const items = packCards(set), tones = spreadTones(items), at = cells(items);
      expect(tones.get("articles")).toBe("sky");
      for (const b of items) if (b.key !== "articles" && touching(at.get("articles")!, at.get(b.key)!)) expect(tones.get(b.key), b.key).not.toBe("sky");
    }
  });
});

describe("cards fill every row", () => {
  const rows = (items: { size: "wide" | "half" }[]) => { const r: number[] = []; let col = 0; for (const it of items) { if (it.size === "wide") { if (col) r.push(col); r.push(2); col = 0; } else { col++; if (col === 2) { r.push(2); col = 0; } } } if (col) r.push(col); return r; };
  it("a half-width card is never left alone in a row, whatever menus are shown", () => {
    const sets = [NAV.filter((n) => n.home && n.area === "admin"), NAV.filter((n) => n.home && n.area === "traveler"), NAV.filter((n) => n.home && n.area === "traveler" && !n.viewerOnly),
      NAV.filter((n) => n.home && n.area === "traveler" && !["notifications", "account", "gov"].includes(n.key)), NAV.filter((n) => n.home && n.area === "admin").slice(0, 7)];
    for (const set of sets) { expect(rows(packCards(set)).every((n) => n === 2), set.map((n) => n.key).join()).toBe(true); expect(packCards(set).map((n) => n.key)).toEqual(set.map((n) => n.key)); }
  });
  it("fixes the known cases: half before wide, and a half at the end", () => {
    const h = { size: "half" as const }, w = { size: "wide" as const };
    expect(rows([h, w])).toEqual([1, 2]); expect(rows(packCards([h, w]))).toEqual([2, 2]);
    expect(rows([w, h, h, h])).toEqual([2, 2, 1]); expect(rows(packCards([w, h, h, h]))).toEqual([2, 2, 2]); expect(packCards([w, h, h, h]).map((x) => x.size)).toEqual(["wide", "half", "half", "wide"]);
    expect(packCards([])).toEqual([]);
  });
});

