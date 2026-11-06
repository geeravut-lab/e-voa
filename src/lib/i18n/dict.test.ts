import { describe, expect, it } from "vitest";
import { DICTS, errorText, fmt } from "./dict";
import { LANG_CODES, pickLang } from "./langs";

describe("dictionaries", () => {
  const keys = Object.keys(DICTS.en).sort();
  it.each(LANG_CODES)("%s has exactly the English keys", (lang) => {
    expect(Object.keys(DICTS[lang]).sort()).toEqual(keys);
  });
  it.each(LANG_CODES)("%s has no empty text", (lang) => {
    for (const [k, v] of Object.entries(DICTS[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe("");
  });
  it.each(LANG_CODES)("%s keeps the same {placeholders}", (lang) => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of keys) expect(ph((DICTS[lang] as Record<string, string>)[k]), `${lang}.${k}`).toBe(ph((DICTS.en as Record<string, string>)[k]));
  });
});

describe("helpers", () => {
  it("fmt fills placeholders and leaves unknown ones", () => {
    expect(fmt("Hi {name} {x}", { name: "A" })).toBe("Hi A {x}");
  });
  it("errorText falls back for unknown codes", () => {
    expect(errorText("err_forbidden", DICTS.en)).toBe(DICTS.en.err_forbidden);
    expect(errorText("nope", DICTS.en)).toBe(DICTS.en.err_generic);
    expect(errorText(undefined, DICTS.th)).toBe(DICTS.th.err_generic);
  });
  it("pickLang honours q and zh variants", () => {
    expect(pickLang("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
    expect(pickLang("zh-TW,zh;q=0.9")).toBe("zh-CN");
    expect(pickLang("fr-FR,fr;q=0.9")).toBe("en");
    expect(pickLang("fr;q=0.9,th;q=0.5")).toBe("th");
    expect(pickLang(null)).toBe("en");
  });
});
