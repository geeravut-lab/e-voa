import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { passToken, verifyPassToken } from "./passes";

beforeAll(() => { process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });
const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("pass tokens", () => {
  it("round-trips and cannot be forged or moved to another application", () => {
    const t = passToken(ID);
    expect(verifyPassToken(t)).toBe(ID);
    expect(verifyPassToken(t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBeNull();
    expect(verifyPassToken(`123e4567-e89b-12d3-a456-426614174001.${t.split(".")[1]}`)).toBeNull();
    for (const bad of ["", "x", "abc.def", `${ID}.`, `${ID}`, "../etc/passwd.x"]) expect(verifyPassToken(bad)).toBeNull();
  });
  it("a different key gives a different token", () => {
    const a = passToken(ID); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(verifyPassToken(a)).toBeNull();
  });
});
