import { describe, expect, it } from "vitest";
import { LIMITS, appOpenUrl, buildFlex, externalUrl, safeHref, styleOf } from "@/lib/messaging/flex";
import { NOTICE_STYLES } from "@/config/line-colors";

const base = { brand: "ThaiPass e-VOA", buttonLabel: "Open" };
describe("which header a notice gets", () => {
  it("follows the kind", () => {
    const want: [string, string][] = [["application.approved", "success"], ["application.rejected", "danger"], ["application.submission_failed", "danger"], ["application.action_required", "warning"], ["rule.payment_reminder", "warning"], ["rule.expired", "warning"],
      ["payment.paid", "money"], ["application.upgrade", "money"], ["payment.refund", "refund"], ["addon.ready", "extra"], ["addon.used", "extra"], ["partner.sale", "extra"], ["application.submitted", "info"], ["x", "info"]];
    for (const [k, s] of want) expect(styleOf(k), k).toBe(s); expect(styleOf(undefined)).toBe("info");
  });
});
describe("the card", () => {
  const f = buildFlex({ ...base, title: "Your application was approved", kind: "application.approved", fields: [["Reference", "EV-26-000116"], ["Status", "Approved"]], url: "https://e-voa.example/trips", note: "Thank you!" });
  it("has a colored header with the brand and the title, rows, a note and one button", () => {
    const c = f.contents as { header: { backgroundColor: string; contents: { text: string }[] }; body: { contents: unknown[] }; footer: { contents: { type: string }[] } };
    expect(c.header.backgroundColor).toBe(NOTICE_STYLES.success.color); expect(c.header.contents[0].text).toContain("ThaiPass e-VOA"); expect(c.header.contents[1].text).toBe("Your application was approved");
    expect(c.body.contents).toHaveLength(2); expect(c.footer.contents.map((x) => x.type)).toEqual(["text", "button"]);
  });
  it("opens the page in the phone's browser, and the alt text carries the details for the lock screen", () => {
    expect(JSON.stringify(f.contents)).toContain("https://e-voa.example/trips?openExternalBrowser=1"); expect(f.altText).toBe("Your application was approved — Reference EV-26-000116 · Status Approved");
  });
  it("cuts everything to LINE's limits (LINE refuses the whole message otherwise)", () => {
    const long = "x".repeat(500), g = buildFlex({ ...base, title: long, fields: Array.from({ length: 12 }, (_, i) => [`label${i}${long}`, long] as [string, string]), note: long, url: "https://e-voa.example/", buttonLabel: long });
    expect(g.altText.length).toBeLessThanOrEqual(LIMITS.alt); const c = g.contents as { header: { contents: { text: string }[] }; body: { contents: { contents: { text: string }[] }[] }; footer: { contents: { text?: string; action?: { label: string } }[] } };
    expect(c.header.contents[1].text.length).toBeLessThanOrEqual(LIMITS.title); expect(c.body.contents).toHaveLength(LIMITS.rows);
    for (const row of c.body.contents) { expect(row.contents[0].text.length).toBeLessThanOrEqual(LIMITS.label); expect(row.contents[1].text.length).toBeLessThanOrEqual(LIMITS.value); }
    expect(c.footer.contents[0].text!.length).toBeLessThanOrEqual(LIMITS.note); expect(c.footer.contents[1].action!.label.length).toBeLessThanOrEqual(20);
  });
  it("with no rows the text goes in the body; with no link there is no button; empty rows are dropped", () => {
    const g = buildFlex({ ...base, title: "Hello", text: "Some words" }); const c = g.contents as { body: { contents: { text: string }[] }; footer?: unknown };
    expect(c.body.contents[0].text).toBe("Some words"); expect(c.footer).toBeUndefined(); expect(g.altText).toBe("Hello — Some words");
    expect((buildFlex({ ...base, title: "T", fields: [["", "x"], ["y", ""]] }).contents as { body: { contents: unknown[] } }).body.contents).toHaveLength(1);        // falls back to the title text
  });
  it("accepts only http(s) addresses for the button", () => {
    expect(externalUrl("https://a.example/x?y=1")).toBe("https://a.example/x?y=1&openExternalBrowser=1"); expect(externalUrl("javascript:alert(1)")).toBeNull(); expect(externalUrl("line://app")).toBeNull(); expect(externalUrl("nope")).toBeNull();
    expect(JSON.stringify(buildFlex({ ...base, title: "T", url: "javascript:alert(1)" }).contents)).not.toContain("javascript");
  });
});
describe("header colors", () => { it("are hex strings that keep white text readable", () => {
  const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const [k, v] of Object.entries(NOTICE_STYLES)) { expect(v.color, k).toMatch(/^#[0-9A-F]{6}$/); expect(1.05 / (lum(v.color) + 0.05), k).toBeGreaterThanOrEqual(4.5); }
}); });

describe("the same rules as the RooSuk card (docs/LINE-FLEX-CARD-KNOWLEDGE.md)", () => {
  it("a summary line comes first, then the rows; the card shows at most 8 lines and the alt text carries all of them", () => {
    const g = buildFlex({ ...base, title: "Order shipped", text: "Your order has left the warehouse", fields: [["Carrier", "Flash"], ["Tracking", "TH0123"]], url: "https://e-voa.example/trips" });
    const c = g.contents as { body: { contents: { type: string; text?: string }[] } };
    expect(c.body.contents.map((x) => x.type)).toEqual(["text", "box", "box"]); expect(c.body.contents[0].text).toBe("Your order has left the warehouse");
    expect(g.altText).toBe("Order shipped — Your order has left the warehouse · Carrier Flash · Tracking TH0123");
    const many = buildFlex({ ...base, title: "T", text: "S", fields: Array.from({ length: 20 }, (_, i) => [`l${i}`, `v${i}`] as [string, string]) }); expect((many.contents as { body: { contents: unknown[] } }).body.contents).toHaveLength(LIMITS.rows);
  });
  it("2,000 characters in 20 lines: alt text <= 400, no text over its limit, at most 9 pieces (summary + 8 rows)", () => {
    const x = "ก".repeat(2000), g = buildFlex({ ...base, title: x, text: x, note: x, buttonLabel: x, url: "https://e-voa.example/", fields: Array.from({ length: 20 }, () => [x, x] as [string, string]) });
    expect(g.altText.length).toBeLessThanOrEqual(400); const c = g.contents as { header: { contents: { text: string }[] }; body: { contents: { text?: string; contents?: { text: string }[] }[] } };
    expect(c.body.contents.length).toBeLessThanOrEqual(9); expect(c.header.contents[1].text.length).toBeLessThanOrEqual(100);
    for (const piece of c.body.contents) { if (piece.text) expect(piece.text.length).toBeLessThanOrEqual(300); for (const t of piece.contents ?? []) expect(t.text.length).toBeLessThanOrEqual(120); }
  });
  it("the button only ever leads to our own site: odd paths fall back to the home page, and there is never an external address", () => {
    expect(safeHref("/trips")).toBe("/trips"); expect(safeHref("/a?b=1")).toBe("/a?b=1");
    for (const bad of ["https://evil.example", "//evil.example", "evil", "", null, undefined, "/x".padEnd(301, "y"), "/a\\b", "/a\nb"]) expect(safeHref(bad as string), String(bad)).toBeNull();
    expect(appOpenUrl("https://e-voa.example/", "/trips")).toBe("https://e-voa.example/trips?openExternalBrowser=1"); expect(appOpenUrl("https://e-voa.example", "/a?b=1")).toBe("https://e-voa.example/a?b=1&openExternalBrowser=1");
    for (const bad of ["https://evil.example", "//evil", "", null]) expect(appOpenUrl("https://e-voa.example", bad)).toBe("https://e-voa.example/?openExternalBrowser=1");
    expect(appOpenUrl("https://e-voa.example", "/trips")).not.toContain("liff.line.me");                                              // no LIFF: the phone's own browser opens it
  });
});

