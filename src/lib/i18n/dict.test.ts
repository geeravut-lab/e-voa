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
    expect(pickLang("zh-TW,zh;q=0.9")).toBe("zh-TW");
    expect(pickLang("zh-HK")).toBe("zh-TW"); expect(pickLang("zh-CN,zh;q=0.9")).toBe("zh-CN"); expect(pickLang("zh")).toBe("zh-CN");
    expect(pickLang("hi-IN,hi;q=0.9")).toBe("hi"); expect(pickLang("ar-SA")).toBe("ar"); expect(pickLang("ru")).toBe("ru"); expect(pickLang("ko-KR")).toBe("ko"); expect(pickLang("ja-JP")).toBe("ja");
    expect(pickLang("fr-FR,fr;q=0.9")).toBe("en");
    expect(pickLang("fr;q=0.9,th;q=0.5")).toBe("th");
    expect(pickLang(null)).toBe("en");
  });
});

describe("languages that are translated for travelers", () => {
  const STAFF = /^(admin_|admins_|agency_|partner_|ops_|rev_|audit_|rules_|an_|imm_|company_|brand_|settings_|errors_|analytics_|features_|msg_|channels_|card_(ops|branding|features|admins|audit|analytics|settings|immigration|agency|partner)|ai_(title|hint|task_|primary|fallback|use_default|model_for|key_|test|events_)|prompts_|recon_|discounts_|content_|err_content_|err_role_|err_ops_|err_toolkit_|tourism_|gov_|err_gov_|err_prompt_|err_discount_(code_format|exists)|err_sim_|err_ai_(nokey|model_unknown|free_tier|test_failed)$|home_section_admin|nav_admin|nav_alerts|nav_queue|trust_|ai_s[0-9]$)/;
  const traveler = Object.keys(DICTS.en).filter((k) => !STAFF.test(k));
  it.each(["hi", "ar", "ru", "ko", "ja", "zh-TW"] as const)("%s translates every traveler-facing text (not left in English)", (lang) => {
    const same = traveler.filter((k) => (DICTS[lang] as Record<string, string>)[k] === (DICTS.en as Record<string, string>)[k] && /[a-z]{4}/.test((DICTS.en as Record<string, string>)[k]) && !/^(ThaiPass|you@|LINE|eSIM|E-mail|Email|Passport|Visa|e-VOA|Google|PDF)/.test((DICTS.en as Record<string, string>)[k]));
    expect(same, `${lang}: ${same.slice(0, 8).join(", ")}`).toEqual([]);
  });
});
