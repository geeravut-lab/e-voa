import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAPS, ROLES, ROLE_CAPS, capsOf, can, isRole } from "@/lib/roles";
import { NAV, navAllowed } from "@/config/nav";

describe("staff roles", () => {
  it("the owner has every capability; unknown roles have none", () => {
    expect([...capsOf(null, true)]).toEqual([...CAPS]); expect(capsOf("hacker", false)).toEqual([]); expect(capsOf(undefined, false)).toEqual([]); expect(isRole("operator")).toBe(true); expect(isRole("owner")).toBe(false);
  });
  it("only the owner can manage staff; no role gets it", () => { for (const r of ROLES) expect(ROLE_CAPS[r]).not.toContain("staff"); expect(can(capsOf("manager", false), "staff")).toBe(false); });
  it("each role gets what its description says", () => {
    expect(ROLE_CAPS.manager).toEqual(["ops", "finance", "content", "config", "audit"]); expect(ROLE_CAPS.operator).toEqual(["ops"]); expect(ROLE_CAPS.finance).toEqual(["finance", "audit"]); expect(ROLE_CAPS.editor).toEqual(["content"]);
    expect(can([], undefined)).toBe(true);
  });
});

describe("every back-office entry is protected by the capability its menu entry names", () => {
  const admin = NAV.filter((n) => n.area === "admin" && n.href.startsWith("/admin/"));
  const need = (n: { cap?: unknown }) => JSON.stringify(n.cap);
  it("menu entries and their pages agree (a hidden menu is not access control, so the page checks the same capability)", () => {
    for (const n of admin) {
      if (!n.cap) continue;
      const src = readFileSync(`src/app${n.href}/page.tsx`, "utf8");
      const m = /requireAdminPage\(([^)]*)\)/.exec(src); expect(m, n.key).toBeTruthy();
      expect(m![1].replace(/\s/g, ""), n.key).toBe(need(n).replace(/\s/g, ""));
    }
  });
  it("entries without a capability are only the home, the alerts and the account", () => { expect(admin.filter((n) => !n.cap).map((n) => n.key).sort()).toEqual(["admin_notifs", "admin_account"].filter((k) => admin.some((n) => n.key === k)).sort()); });
  it("each role sees only its own menus", () => {
    const keys = (role: keyof typeof ROLE_CAPS) => admin.filter((n) => navAllowed(n, ROLE_CAPS[role])).map((n) => n.key);
    expect(keys("operator")).toContain("ops"); expect(keys("operator")).not.toContain("revenue"); expect(keys("operator")).not.toContain("settings");
    expect(keys("editor")).toEqual(expect.arrayContaining(["content", "prompts", "airports"])); expect(keys("editor")).not.toContain("ops");
    expect(keys("finance")).toEqual(expect.arrayContaining(["revenue", "reconcile", "discounts", "ops", "audit"])); expect(keys("manager")).not.toContain("admins");
    expect(admin.filter((n) => navAllowed(n, CAPS)).map((n) => n.key)).toContain("admins");
  });
});

describe("every server action of the back office asks for its capability on the first line", () => {
  for (const f of ["admin", "ops", "immigration"]) {
    it(`${f}.ts`, () => {
      const src = readFileSync(`src/app/actions/${f}.ts`, "utf8");
      const calls = src.match(/requireAdminAction\(([^)]*)\)/g) ?? [];
      expect(calls.length).toBeGreaterThan(3);
      for (const c of calls) if (!c.includes("import")) expect(c, c).toMatch(/requireAdminAction\((\"[a-z]+\"|\[[^\]]+\])\)/);
    });
  }
});
