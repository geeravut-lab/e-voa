import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EMERGENCY, LEVEL_LABEL, PHRASES, RULES_CHECK, STAY, TDAC, TDAC_URL, LAST_REVIEWED } from "@/lib/content/toolkit";
import { forLang } from "@/lib/content/types";
import { renderOfflineEmergency } from "@/lib/content/toolkit-store";

const LANGS = ["en", "th", "zh-CN"] as const;
describe("the offline emergency page", () => {
  const html = renderOfflineEmergency({ emergency: EMERGENCY, phrases: PHRASES });
  it("lists exactly the numbers it is given, each with a tel: link", () => {
    expect([...html.matchAll(/data-n="(\d+)"/g)].map((m) => m[1]).sort()).toEqual(EMERGENCY.map((e) => e.number).sort());
    for (const e of EMERGENCY) expect(html).toContain(`href="tel:${e.number}"`);
  });
  it("holds no script, escapes what staff typed, and is kept by the service worker", () => {
    expect(html).not.toMatch(/<script/i); expect(html).toMatch(/noindex/);
    const evil = renderOfflineEmergency({ emergency: [{ number: "999", label: { en: "<img src=x onerror=alert(1)>", th: "ก", "zh-CN": "x" }, use: { en: "a & b", th: "x", "zh-CN": "x" } }], phrases: [] });
    expect(evil).not.toContain("<img"); expect(evil).toContain("&#60;img"); expect(evil).toContain("a &#38; b");
    expect(readFileSync("public/sw.js", "utf8")).toContain("/offline-emergency.html");
  });
  it("shows the urgent Thai phrases", () => { for (const p of PHRASES.filter((x) => x.urgent).slice(0, 8)) expect(html).toContain(p.th); });
});

describe("toolkit texts", () => {
  it("every emergency number, rule, level and guide is written in English, Thai and Chinese", () => {
    for (const e of EMERGENCY) { expect(e.number).toMatch(/^\d{3,4}$/); for (const l of LANGS) { expect(e.label[l], `${e.number} ${l}`).toBeTruthy(); expect(e.use[l]).toBeTruthy(); } }
    for (const r of RULES_CHECK) for (const l of LANGS) { expect(r.title[l], `${r.id} ${l}`).toBeTruthy(); expect(r.text[l].length, `${r.id} ${l}`).toBeGreaterThan(30); }
    for (const l of LANGS) { for (const k of Object.keys(LEVEL_LABEL) as (keyof typeof LEVEL_LABEL)[]) expect(LEVEL_LABEL[k][l]).toBeTruthy(); const s = forLang(STAY, l), d = forLang(TDAC, l); for (const v of Object.values(s)) expect(v.length).toBeGreaterThan(10); expect(d.steps.length).toBe(forLang(TDAC, "en").steps.length); expect(d.warn.length).toBe(forLang(TDAC, "en").warn.length); }
  });
  it("rule ids and phrase ids are unique; phrases carry Thai, a reading and two meanings", () => {
    expect(new Set(RULES_CHECK.map((r) => r.id)).size).toBe(RULES_CHECK.length); expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    for (const p of PHRASES) { expect(p.th).toMatch(/[ก-๙]/); expect(p.roman.length).toBeGreaterThan(2); expect(p.en).toBeTruthy(); expect(p.zh).toBeTruthy(); }
    expect(PHRASES.filter((p) => p.urgent).length).toBeGreaterThanOrEqual(4);
  });
  it("send people to the official TDAC site, not to an address of ours, and carry a review date", () => { expect(new URL(TDAC_URL).protocol).toBe("https:"); expect(new URL(TDAC_URL).hostname).toMatch(/\.go\.th$/); expect(LAST_REVIEWED).toMatch(/^\d{4}-\d{2}$/); });
});
