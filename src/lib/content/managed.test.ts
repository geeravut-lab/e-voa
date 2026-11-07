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
