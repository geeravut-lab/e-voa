import { describe, expect, it } from "vitest";
import { LIMITS, buildFlex, externalUrl, styleOf } from "@/lib/messaging/flex";
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
