import { describe, expect, it } from "vitest";
import { LINK_TTL_HOURS, hashToken, linkExpiry, linkState, newToken, shortName, validToken } from "@/lib/paylink/rules";

describe("pay-later link secrets", () => {
  it("are 256-bit, URL-safe, different every time, and only their hash is ever stored", () => {
    const a = newToken(), b = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(a).not.toBe(b); expect(validToken(a)).toBe(true);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/); expect(hashToken(a)).not.toContain(a); expect(hashToken(a)).toBe(hashToken(a)); expect(hashToken(a)).not.toBe(hashToken(b));
  });
  it("anything else is refused before the database is asked", () => {
    for (const bad of ["", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`, `${"a".repeat(42)}/`, null, undefined, 42, ["a"]]) expect(validToken(bad as unknown), String(bad)).toBe(false);
  });
});
describe("pay-later link life", () => {
  const NOW = new Date("2026-11-07T10:00:00Z");
  it("is active, expired or revoked", () => {
    expect(linkState({ expires_at: "2026-11-08T00:00:00Z", revoked_at: null }, NOW)).toBe("active"); expect(linkState({ expires_at: "2026-11-07T10:00:00Z", revoked_at: null }, NOW)).toBe("expired");
    expect(linkState({ expires_at: "2026-11-08T00:00:00Z", revoked_at: "2026-11-07T09:00:00Z" }, NOW)).toBe("revoked");
  });
  it("lasts 72 hours but never longer than the application it pays for", () => {
    expect(linkExpiry(NOW).getTime()).toBe(NOW.getTime() + LINK_TTL_HOURS * 3_600_000);
    const closes = NOW.getTime() + 5 * 3_600_000; expect(linkExpiry(NOW, closes).getTime()).toBe(closes);
    expect(linkExpiry(NOW, NOW.getTime() + 999 * 3_600_000).getTime()).toBe(NOW.getTime() + 72 * 3_600_000);
  });
  it("shows the payer only a first name and the first letter of the surname", () => {
    expect(shortName("Anna", "Kowalski")).toBe("Anna K."); expect(shortName(" Li ", "")).toBe("Li"); expect(shortName(null, undefined)).toBe("—");
  });
});
