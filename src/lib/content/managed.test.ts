import { describe, expect, it } from "vitest";
import { cleanTexts, pickText, BODY_MAX } from "@/lib/content/managed";

describe("text in the reader's language", () => {
  const m = { en: "Hello", th: "สวัสดี", "zh-CN": "你好" };
  it("uses the reader's language, then English, then anything", () => {
    expect(pickText(m, "th")).toBe("สวัสดี"); expect(pickText(m, "zh-CN")).toBe("你好"); expect(pickText(m, "ja")).toBe("Hello");
    expect(pickText({ th: "สวัสดี" }, "en")).toBe("สวัสดี"); expect(pickText({ en: "   ", th: "x" }, "en")).toBe("x");
  });
  it("is empty for anything that is not a text map", () => { for (const bad of [null, undefined, "x", 5, [], {}]) expect(pickText(bad, "en")).toBe(""); });
});
describe("cleaning what staff type", () => {
  it("trims, keeps line breaks, drops hidden and control characters, and leaves empty languages out", () => {
    const out = cleanTexts({ en: "  Line 1\r\nLine 2‮\u0007  ", th: "   ", "zh-CN": "ok" }, 100);
    expect(out).toEqual({ en: "Line 1\nLine 2", "zh-CN": "ok" });
  });
  it("limits the length", () => { expect(cleanTexts({ en: "x".repeat(BODY_MAX + 50) }, BODY_MAX).en).toHaveLength(BODY_MAX); });
});

import { parseSections, sectionsToText, validSlug } from "@/lib/content/managed";
describe("article text ↔ sections", () => {
  it("## starts a section and a blank line ends a paragraph; lines inside a paragraph are joined", () => {
    const s = parseSections("Intro line one\nstill the intro\n\n## First\n\nPara A line 1\nline 2\n\nPara B\n\n## Second\nOnly one paragraph");
    expect(s).toEqual([{ h: "", p: ["Intro line one still the intro"] }, { h: "First", p: ["Para A line 1 line 2", "Para B"] }, { h: "Second", p: ["Only one paragraph"] }]);
  });
  it("round-trips", () => {
    const sections = [{ h: "One", p: ["a", "b"] }, { h: "Two", p: ["c"] }]; expect(parseSections(sectionsToText(sections))).toEqual(sections);
    expect(parseSections(sectionsToText([{ h: "", p: ["x"] }]))).toEqual([{ h: "", p: ["x"] }]);
  });
  it("is empty for empty text and never keeps markup as markup (it stays text)", () => { expect(parseSections("  \n\n ")).toEqual([]); expect(parseSections("<script>alert(1)</script>")[0].p[0]).toBe("<script>alert(1)</script>"); });
  it("accepts only tidy slugs", () => { for (const ok of ["how-it-works", "abc", "a1-b2-c3"]) expect(validSlug(ok), ok).toBe(true); for (const bad of ["ab", "Has-Caps", "double--dash", "-lead", "trail-", "with space", "x".repeat(81), "a/b", ""]) expect(validSlug(bad), bad).toBe(false); });
});
