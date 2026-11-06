import { describe, expect, it } from "vitest";
import { DICTS } from "@/lib/i18n/dict";
import { STATUSES } from "@/lib/applications/state";
import { NAV } from "@/config/nav";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

describe("screens and words", () => {
  it("every application status has a name and a hint in every language", () => {
    for (const [lang, t] of Object.entries(DICTS)) for (const s of STATUSES) {
      const d = t as unknown as Record<string, string>;
      expect(d[`st_${s}`], `${lang} st_${s}`).toBeTruthy(); expect(d[`sth_${s}`], `${lang} sth_${s}`).toBeTruthy();
    }
  });
  it("every add-on status has a name", () => {
    for (const [lang, t] of Object.entries(DICTS)) for (const s of ["pending_payment", "paid", "issuing", "issued", "used", "failed", "refunded", "cancelled"])
      expect((t as unknown as Record<string, string>)[`addon_st_${s}`], `${lang} ${s}`).toBeTruthy();
  });
  it("every live menu entry points to a page that exists", () => {
    const appDir = path.resolve(__dirname, "../app");
    const has = (href: string) => { const dir = path.join(appDir, ...href.split("/").filter(Boolean)); return existsSync(path.join(dir, "page.tsx")); };
    for (const n of NAV.filter((x) => x.status === "live")) expect(href(n.href) || has(n.href), n.key + " " + n.href).toBe(true);
    function href(h: string) { return h === "/" ? existsSync(path.join(appDir, "page.tsx")) : false; }
    expect(readdirSync(appDir).length).toBeGreaterThan(5);
  });
});
