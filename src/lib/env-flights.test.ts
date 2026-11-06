import { afterEach, describe, expect, it } from "vitest";
import { envValue } from "@/lib/env";

describe("envValue: a setting typed as null/blank means NOT set", () => {
  afterEach(() => { delete process.env.TEST_SETTING; });
  it.each(["", " ", "null", "NULL", "undefined", "none", "-", "n/a"])("%j is not set", (v) => { process.env.TEST_SETTING = v; expect(envValue("TEST_SETTING")).toBe(""); });
  it("a real value is returned trimmed; a missing one is empty", () => {
    process.env.TEST_SETTING = "  https://x.example/api  "; expect(envValue("TEST_SETTING")).toBe("https://x.example/api");
    delete process.env.TEST_SETTING; expect(envValue("TEST_SETTING")).toBe("");
  });
});
