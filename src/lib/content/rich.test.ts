import { describe, expect, it } from "vitest";
import { parseInline, parseRich, richImages, richPlain, safeHref } from "./rich";

describe("safe links", () => {
  it("accepts web, mail and in-site paths only", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("mailto:team@example.com")).toBe("mailto:team@example.com");
    expect(safeHref("/news")).toBe("/news");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>", "//evil.example", "vbscript:x", "https://a b.com", "ftp://x.com", "", "https://x.com/\"onclick=", "https://x.com/<b>"]) expect(safeHref(bad), bad).toBeNull();
  });
});
describe("inline marks", () => {
  it("reads bold, italic and links, and leaves unclosed marks as typed", () => {
    expect(parseInline("a **b** c *d* [e](https://x.com)")).toEqual([
      { t: "text", v: "a " }, { t: "b", c: [{ t: "text", v: "b" }] }, { t: "text", v: " c " }, { t: "i", c: [{ t: "text", v: "d" }] }, { t: "text", v: " " }, { t: "a", href: "https://x.com", c: [{ t: "text", v: "e" }] },
    ]);
    expect(parseInline("2 * 3 = 6 and **open")).toEqual([{ t: "text", v: "2 * 3 = 6 and **open" }]);
    expect(parseInline("\\*not italic\\*")).toEqual([{ t: "text", v: "*not italic*" }]);
  });
  it("shows a dangerous link as plain text, never as a link", () => {
    const x = parseInline("[click](javascript:alert(1))");
    expect(x.every((n) => n.t === "text")).toBe(true);
  });
  it("keeps typed HTML as text", () => {
    expect(parseInline("<script>alert(1)</script> <img src=x onerror=y>")).toEqual([{ t: "text", v: "<script>alert(1)</script> <img src=x onerror=y>" }]);
  });
});
describe("blocks", () => {
  const img = "0123456789abcdef01234567.webp";
  it("reads headings, paragraphs, lists, quotes, dividers and pictures", () => {
    const b = parseRich(`## Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2) b\n\n> note\n\n---\n\n![A beach](/news-img/${img})`);
    expect(b.map((x) => x.t)).toEqual(["h", "p", "ul", "ol", "quote", "hr", "img"]);
    expect(b[1]).toEqual({ t: "p", c: [{ t: "text", v: "First line\nsecond line" }] });
    expect(b[2]).toMatchObject({ t: "ul" }); expect((b[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(b[6]).toEqual({ t: "img", name: img, alt: "A beach" });
  });
  it("accepts only our own picture addresses", () => {
    for (const bad of ["![x](https://evil.example/a.png)", "![x](/news-img/../../etc/passwd)", "![x](/news-img/short.webp)", "![x](/news-img/0123456789abcdef01234567.svg)", "![x](javascript:alert(1))"]) {
      expect(parseRich(bad).some((x) => x.t === "img"), bad).toBe(false);
    }
  });
  it("lists the pictures a text uses, once each, and gives a plain version", () => {
    const t = `Hello **world**\n\n![a](/news-img/${img})\n![b](/news-img/${img})\n\n- x\n- y`;
    expect(richImages(t)).toEqual([img]);
    expect(richPlain(t)).toBe("Hello world\n[a]\n[b]\nx; y");
  });
  it("copes with empty and odd input", () => {
    expect(parseRich("")).toEqual([]); expect(parseRich("   \n\n  ")).toEqual([]);
    expect(() => parseRich("#".repeat(5000) + "\n" + "*".repeat(5000) + "[".repeat(3000))).not.toThrow();
    expect(parseRich("Plain old text from before.\nSecond line.")).toEqual([{ t: "p", c: [{ t: "text", v: "Plain old text from before.\nSecond line." }] }]);
  });
});
