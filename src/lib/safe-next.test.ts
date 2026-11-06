import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/trips?x=1")).toBe("/trips?x=1");
    expect(safeNext("/")).toBe("/");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "", null, undefined, "/a\nb"])
      expect(safeNext(bad as string | null)).toBe("/");
  });
  it("uses the given fallback", () => expect(safeNext("x", "/home")).toBe("/home"));
});
