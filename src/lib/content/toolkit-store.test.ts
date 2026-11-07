import { describe, expect, it } from "vitest";
import { BUILTIN, FORM_ROWS, LIMITS, mergeToolkit, parseToolkit, parseToolkitForm } from "@/lib/content/toolkit-store";

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
describe("stored toolkit lists", () => {
  it("fall back to the built-in lists when nothing (or nothing valid) is stored", () => {
    expect(mergeToolkit(parseToolkit(null))).toEqual(BUILTIN); expect(mergeToolkit(parseToolkit({ emergency: [], phrases: "x", rules: [{ nope: 1 }] }))).toEqual(BUILTIN); expect(mergeToolkit(parseToolkit(undefined))).toEqual(BUILTIN);
  });
  it("use an edited list in place of the built-in one, and drop damaged items", () => {
    const p = parseToolkit({ emergency: [{ number: "1155", label: { en: "Tourist police" }, use: { en: "Help" } }, { number: "12", label: { en: "x" }, use: { en: "x" } }, { number: "1155", label: { en: "dup" }, use: { en: "dup" } }, { number: "191", label: { en: "" }, use: { en: "x" } }] });
    expect(p.emergency).toEqual([{ number: "1155", label: { en: "Tourist police", th: "Tourist police", "zh-CN": "Tourist police" }, use: { en: "Help", th: "Help", "zh-CN": "Help" } }]);
    expect(mergeToolkit(p).phrases).toEqual(BUILTIN.phrases);
  });
  it("phrases need Thai letters and a meaning; rules need a known kind", () => {
    const p = parseToolkit({ phrases: [{ th: "hello", en: "Hello" }, { th: "สวัสดี", roman: "sa-wat-dee", en: "Hello", urgent: true }, { th: "ขอบคุณ", en: "" }], rules: [{ level: "weird", title: { en: "T" }, text: { en: "X" } }, { level: "illegal", title: { en: "T" }, text: { en: "X" } }] });
    expect(p.phrases).toHaveLength(1); expect(p.phrases![0]).toMatchObject({ th: "สวัสดี", zh: "Hello", urgent: true }); expect(p.rules).toHaveLength(1); expect(p.rules![0].level).toBe("illegal");
  });
  it("cut over-long text and cap the number of items", () => {
    const p = parseToolkit({ rules: Array.from({ length: 99 }, () => ({ level: "careful", title: { en: "t".repeat(500) }, text: { en: "x".repeat(5000) } })) });
    expect(p.rules).toHaveLength(LIMITS.rules); expect(p.rules![0].title.en).toHaveLength(LIMITS.title); expect(p.rules![0].text.en).toHaveLength(LIMITS.text);
  });
});
describe("the back-office form", () => {
  it("reads rows, skips blank and deleted rows, and returns clean lists", () => {
    const r = parseToolkitForm("emergency", form({ "emergency.0.number": "1155", "emergency.0.label.en": "Tourist police", "emergency.0.use.en": "Help", "emergency.1.number": "191", "emergency.1.label.en": "Police", "emergency.1.use.en": "Any", "emergency.1.del": "on", "emergency.2.number": "", "emergency.2.label.en": "" }));
    expect(r.ok && r.list).toHaveLength(1);
  });
  it("refuses an empty list, a bad number, a repeated number, phrases without Thai, and rules without text — with a code, never a crash", () => {
    expect(parseToolkitForm("emergency", form({}))).toEqual({ ok: false, error: "err_toolkit_empty" });
    expect(parseToolkitForm("emergency", form({ "emergency.0.number": "12", "emergency.0.label.en": "x", "emergency.0.use.en": "y" }))).toEqual({ ok: false, error: "err_toolkit_number" });
    expect(parseToolkitForm("emergency", form({ "emergency.0.number": "191", "emergency.0.label.en": "x", "emergency.0.use.en": "y", "emergency.1.number": "191", "emergency.1.label.en": "x", "emergency.1.use.en": "y" }))).toEqual({ ok: false, error: "err_toolkit_number" });
    expect(parseToolkitForm("phrases", form({ "phrases.0.th": "hello", "phrases.0.en": "Hello" }))).toEqual({ ok: false, error: "err_toolkit_thai" });
    expect(parseToolkitForm("rules", form({ "rules.0.level": "careful", "rules.0.title.en": "Only a title" }))).toEqual({ ok: false, error: "err_toolkit_incomplete" });
    expect(parseToolkitForm("rules", form({ "rules.0.level": "nonsense", "rules.0.title.en": "T", "rules.0.text.en": "X" }))).toEqual({ ok: false, error: "err_toolkit_incomplete" });
  });
  it("refuses more rows than the list allows", () => {
    const o: Record<string, string> = {}; for (let i = 0; i < FORM_ROWS; i++) { o[`phrases.${i}.th`] = "สวัสดี"; o[`phrases.${i}.en`] = "Hello"; }
    expect(parseToolkitForm("phrases", form(o))).toEqual({ ok: false, error: "err_toolkit_too_many" });
  });
  it("round-trips the built-in lists through the form fields", () => {
    const o: Record<string, string> = {}; BUILTIN.rules.forEach((r, i) => { o[`rules.${i}.level`] = r.level; o[`rules.${i}.title.en`] = r.title.en; o[`rules.${i}.title.th`] = r.title.th; o[`rules.${i}.title.zh`] = r.title["zh-CN"]; o[`rules.${i}.text.en`] = r.text.en; o[`rules.${i}.text.th`] = r.text.th; o[`rules.${i}.text.zh`] = r.text["zh-CN"]; });
    const r = parseToolkitForm("rules", form(o)); expect(r.ok && (r.list as { level: string; title: { en: string } }[]).map((x) => [x.level, x.title.en])).toEqual(BUILTIN.rules.map((x) => [x.level, x.title.en]));
  });
});
