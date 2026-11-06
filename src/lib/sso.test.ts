import { describe, expect, it } from "vitest";
import { checkSlug, HubExchangeSchema, syntheticEmail } from "./sso";

describe("HubExchangeSchema", () => {
  it("accepts null display_name / email / avatar and a null firebase", () => {
    const r = HubExchangeSchema.safeParse({ user: { id: "u1", display_name: null, avatar_url: null, email: null, roles: ["admin"] }, app_slug: "e-voa", firebase: null });
    expect(r.success).toBe(true);
  });
  it("still requires a non-empty string id", () => {
    expect(HubExchangeSchema.safeParse({ user: { id: "" }, app_slug: "e-voa" }).success).toBe(false);
    expect(HubExchangeSchema.safeParse({ user: { id: 5 }, app_slug: "e-voa" }).success).toBe(false);
    expect(HubExchangeSchema.safeParse({ user: {}, app_slug: "e-voa" }).success).toBe(false);
  });
});

describe("checkSlug", () => {
  const ok = HubExchangeSchema.parse({ user: { id: "u1" }, app_slug: "e-voa" });
  it("passes the right app and refuses another with 403", () => {
    expect(checkSlug(ok, "e-voa")).toBeNull();
    expect(checkSlug(ok, "other")).toEqual({ status: 403, code: "err_sso_slug" });
  });
});

describe("syntheticEmail", () => {
  it("is deterministic and mail-safe", () => {
    expect(syntheticEmail("U12/ab c", "e-voa.vercel.app")).toBe("aivora+U12_ab_c@e-voa.vercel.app");
  });
});
