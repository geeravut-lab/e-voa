import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CryptoConfigError, decryptBytes, decryptText, encryptBytes, encryptText, hashId, last4, normalizeId, sha256Hex } from "./crypto";

beforeAll(() => { process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("encryption", () => {
  it("round-trips text and bytes", () => {
    expect(decryptText(encryptText("P1234567 สวัสดี"))).toBe("P1234567 สวัสดี");
    const bytes = randomBytes(5000);
    expect(decryptBytes(encryptBytes(bytes)).equals(bytes)).toBe(true);
  });
  it("uses a fresh nonce each time and never stores plaintext", () => {
    const a = encryptText("P1234567"), b = encryptText("P1234567");
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64").toString("latin1")).not.toContain("P1234567");
  });
  it("detects tampering and truncation", () => {
    const blob = encryptBytes(Buffer.from("secret passport image"));
    const bad = Buffer.from(blob); bad[20] ^= 0xff;
    expect(() => decryptBytes(bad)).toThrow();
    expect(() => decryptBytes(blob.subarray(0, 10))).toThrow();
  });
  it("rejects an unknown version", () => {
    const blob = Buffer.from(encryptBytes(Buffer.from("x"))); blob[0] = 9;
    expect(() => decryptBytes(blob)).toThrow(/version/);
  });
  it("a different key cannot decrypt", () => {
    const blob = encryptBytes(Buffer.from("x"));
    const old = process.env.DATA_ENCRYPTION_KEY; process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptBytes(blob)).toThrow();
    process.env.DATA_ENCRYPTION_KEY = old;
  });
  it("refuses to run without a valid key", () => {
    const old = process.env.DATA_ENCRYPTION_KEY; process.env.DATA_ENCRYPTION_KEY = "short";
    expect(() => encryptText("x")).toThrow(CryptoConfigError);
    process.env.DATA_ENCRYPTION_KEY = old;
  });
});

describe("identifier hash", () => {
  it("ignores case, spaces and dashes; differs for different numbers", () => {
    expect(hashId("ab 123-456")).toBe(hashId("AB123456"));
    expect(hashId("AB123456")).not.toBe(hashId("AB123457"));
    expect(normalizeId("ab 12-3")).toBe("AB123");
    expect(last4("ab 123456")).toBe("3456");
  });
  it("is keyed: another key gives another hash", () => {
    const h = hashId("AB123456"); const old = process.env.DATA_ENCRYPTION_KEY; process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(hashId("AB123456")).not.toBe(h); process.env.DATA_ENCRYPTION_KEY = old;
  });
  it("sha256Hex matches the known value", () => expect(sha256Hex(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
});
