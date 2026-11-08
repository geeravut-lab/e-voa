import { describe, expect, it } from "vitest";
import { EXTRA_LANGS } from "../types";
import { PACK_A, PACK_B } from "./index";
import { EMERGENCY, PHRASES, RULES_CHECK, TDAC, STAY, LEVEL_LABEL } from "../toolkit";
import { INCIDENTS } from "../incidents";
import { RENTAL, PHOTO_SLOTS } from "../rental";
import { ADVICE } from "@/lib/conditions/rules";
import { AIR_LABEL, UV_LABEL, WEATHER_LABEL } from "@/lib/conditions/labels";
import { FAMILY_TEXT, famText } from "@/lib/family/text";
import { OPS } from "@/lib/i18n/dict/ops-all";
import { en } from "@/lib/i18n/dict/en";

const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const RTL = /[؀-ۿ]/, DEVANAGARI = /[ऀ-ॿ]/, CYRILLIC = /[Ѐ-ӿ]/, HANGUL = /[가-힯]/, KANA = /[぀-ヿ]/, HAN = /[一-鿿]/;
const SCRIPT: Record<string, RegExp> = { hi: DEVANAGARI, ar: RTL, ru: CYRILLIC, ko: HANGUL, ja: KANA, "zh-TW": HAN };

describe.each(EXTRA_LANGS)("toolkit translation: %s", (l) => {
  it("has both packs and the queue texts", () => { expect(PACK_A[l], "pack A").toBeDefined(); expect(PACK_B[l], "pack B").toBeDefined(); expect(OPS[l], "ops").toBeDefined(); });
  it("covers every built-in item (nothing falls back to English)", () => {
    for (const e of EMERGENCY) { expect(e.label[l], `emergency ${e.number}`).toBeTruthy(); expect(e.use[l]).toBeTruthy(); }
    for (const p of PHRASES) expect(p.more?.[l], `phrase ${p.id}`).toBeTruthy();
    for (const r of RULES_CHECK) { expect(r.title[l], `rule ${r.id}`).toBeTruthy(); expect(r.text[l]).toBeTruthy(); }
    for (const k of Object.keys(LEVEL_LABEL)) expect(LEVEL_LABEL[k as keyof typeof LEVEL_LABEL][l], `level ${k}`).toBeTruthy();
    expect(TDAC[l]?.steps.length).toBe(TDAC.en.steps.length); expect(TDAC[l]?.warn.length).toBe(TDAC.en.warn.length); expect(Object.keys(STAY[l] ?? {}).sort()).toEqual(Object.keys(STAY.en).sort());
    for (const i of INCIDENTS) { expect(i.title[l], `incident ${i.id}`).toBeTruthy(); expect(i.summary[l]).toBeTruthy(); expect(i.steps[l]?.length, `steps ${i.id}`).toBe(i.steps.en.length); }
    for (const g of RENTAL) { expect(g.title[l], `rental group ${g.id}`).toBeTruthy(); for (const it of g.items) expect(it.text[l], `rental ${it.id}`).toBeTruthy(); }
    for (const s of PHOTO_SLOTS) expect(s.label[l], `slot ${s.id}`).toBeTruthy();
    for (const k of Object.keys(ADVICE)) expect(ADVICE[k as keyof typeof ADVICE][l], `advice ${k}`).toBeTruthy();
    for (const k of Object.keys(AIR_LABEL)) expect(AIR_LABEL[k as keyof typeof AIR_LABEL][l]).toBeTruthy();
    for (const k of Object.keys(UV_LABEL)) expect(UV_LABEL[k as keyof typeof UV_LABEL][l]).toBeTruthy();
    for (const k of Object.keys(WEATHER_LABEL)) expect(WEATHER_LABEL[k as keyof typeof WEATHER_LABEL][l]).toBeTruthy();
  });
  it("has the same family check-in keys and {placeholders} as English", () => {
    const en_ = famText("en"), t = FAMILY_TEXT[l]!;
    expect(Object.keys(PACK_B[l]!.family).sort()).toEqual(Object.keys(en_).sort());
    for (const k of Object.keys(en_)) expect(ph(t[k]), `${l}.${k}`).toBe(ph(en_[k]));
  });
  it("has all queue (ops_) keys with the same {placeholders}", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("ops_")), o = OPS[l]! as Record<string, string>;
    for (const k of keys) { expect(o[k], `${l}.${k}`).toBeTruthy(); expect(ph(o[k]), `${l}.${k}`).toBe(ph((en as Record<string, string>)[k])); }
  });
  it("is written in the right script and keeps emergency numbers intact", () => {
    const a = PACK_A[l]!;
    expect(a.rulesNote).toMatch(SCRIPT[l]); expect(PACK_B[l]!.family.title).toMatch(SCRIPT[l]);
    for (const n of Object.keys(a.emergency)) expect(EMERGENCY.some((e) => e.number === n), `unknown number ${n}`).toBe(true);
    expect(Object.keys(a.emergency).sort()).toEqual(EMERGENCY.map((e) => e.number).sort());
    for (const i of INCIDENTS) for (const n of i.call) expect(PACK_B[l]!.incidents[i.id].steps.join(" ")).toMatch(/\d{3,4}/);
    expect(a.rulesNote).toContain("{when}"); expect(PACK_B[l]!.incidentNote).toContain("{when}");
  });
});
