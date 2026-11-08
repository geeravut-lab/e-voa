import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { VAULT_CRYPTO_SRC } from "@/lib/vault/crypto-src";
import { VAULT_UI_SRC } from "@/lib/vault/ui-src";
import { renderVaultPage } from "@/lib/vault/page";
import { VAULT_TEXT, vaultText } from "@/lib/vault/text";
import { VAULT_MORE } from "@/lib/vault/text-more";
import { LANG_CODES } from "@/lib/i18n/langs";
import { ALLERGIES, BLOOD, CONDITIONS, HEALTH_LABELS, cleanHealth, emptyHealth, hasHealthData } from "@/lib/vault/health";

// the encryption is the very text that runs on the phone, executed here with Node's WebCrypto
const VC = new Function("crypto", "TextEncoder", "TextDecoder", `${VAULT_CRYPTO_SRC}; return VaultCrypto;`)(webcrypto, TextEncoder, TextDecoder) as {
  ITER: number; rand(n: number): Uint8Array; deriveKey(p: string, s: Uint8Array, i?: number): Promise<CryptoKey>; seal(k: CryptoKey, b: Uint8Array): Promise<{ iv: Uint8Array; ct: Uint8Array }>;
  open(k: CryptoKey, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array>; sealJson(k: CryptoKey, o: unknown): Promise<{ iv: Uint8Array; ct: Uint8Array }>; openJson(k: CryptoKey, iv: Uint8Array, ct: Uint8Array): Promise<unknown>;
};

describe("vault encryption (the phone's own code)", () => {
  it("round-trips data, uses a fresh IV every time, and hides the plaintext", async () => {
    const salt = VC.rand(16), key = await VC.deriveKey("correct horse", salt, 1000);
    const a = await VC.sealJson(key, { title: "Passport", note: "ไทย 日本" }), b = await VC.sealJson(key, { title: "Passport", note: "ไทย 日本" });
    expect(a.iv).toHaveLength(12); expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false); expect(Buffer.from(a.ct).equals(Buffer.from(b.ct))).toBe(false);
    expect(Buffer.from(a.ct).toString("utf8")).not.toContain("Passport");
    expect(await VC.openJson(key, a.iv, a.ct)).toEqual({ title: "Passport", note: "ไทย 日本" });
    const bytes = new Uint8Array(10_000).map((_, i) => i % 251), f = await VC.seal(key, bytes);
    expect(Buffer.from(await VC.open(key, f.iv, f.ct)).equals(Buffer.from(bytes))).toBe(true);
  });
  it("refuses a wrong passcode, a different salt and any tampering", async () => {
    const salt = VC.rand(16), key = await VC.deriveKey("right-pass", salt, 1000), s = await VC.seal(key, new TextEncoder().encode("vault-ok"));
    await expect(VC.open(await VC.deriveKey("wrong-pass", salt, 1000), s.iv, s.ct)).rejects.toThrow();
    await expect(VC.open(await VC.deriveKey("right-pass", VC.rand(16), 1000), s.iv, s.ct)).rejects.toThrow();
    const bad = new Uint8Array(s.ct); bad[0] ^= 1; await expect(VC.open(key, s.iv, bad)).rejects.toThrow();
    expect(VC.ITER).toBeGreaterThanOrEqual(200_000);
  });
});

describe("the vault page", () => {
  it("has a script that parses, in a page that loads nothing from outside", () => {
    expect(() => new Function(VAULT_UI_SRC)).not.toThrow(); expect(VAULT_UI_SRC).not.toMatch(/`|\$\{/); expect(VAULT_UI_SRC).not.toContain("innerHTML");
    const html = renderVaultPage("en");
    expect(html).not.toMatch(/(src|href)="https?:/i); expect(html).not.toMatch(/<link /i); expect(html).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/); expect(VAULT_CRYPTO_SRC + VAULT_UI_SRC).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|localStorage/);
    expect(html).toContain('id="cfg"'); expect(html).toMatch(/noindex/); expect(html.match(/<script/g)).toHaveLength(3);
  });
  it("is written in the reader's language and falls back to English", () => {
    expect(renderVaultPage("en")).toContain(VAULT_TEXT.en.title); expect(renderVaultPage("th")).toContain(VAULT_TEXT.th.title); expect(renderVaultPage("zh-CN")).toContain(VAULT_TEXT["zh-CN"].title); expect(renderVaultPage("ja")).toContain(VAULT_MORE.ja.title);
    for (const l of ["th", "zh-CN"] as const) expect(Object.keys(VAULT_TEXT[l]).sort()).toEqual(Object.keys(VAULT_TEXT.en).sort());
  });
  it("is translated into all nine languages with the same keys and no English left in the others; Arabic is right-to-left", () => {
    const keys = Object.keys(VAULT_TEXT.en).sort();
    for (const l of LANG_CODES) { const t = vaultText(l); expect(Object.keys(t).sort(), l).toEqual(keys); if (l !== "en") for (const k of ["title", "intro", "forget", "create_title", "wrong", "erase_confirm"]) expect(t[k], `${l}.${k}`).not.toBe(VAULT_TEXT.en[k]); }
    expect(renderVaultPage("ar")).toContain('dir="rtl"'); expect(renderVaultPage("en")).toContain('dir="ltr"'); expect(renderVaultPage("zh-TW")).toContain('lang="zh-TW"');
  });
  it("cannot be broken out of by what is in the configuration", () => {
    const html = renderVaultPage("en"), cfg = /<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(cfg).not.toContain("<"); expect(JSON.parse(cfg).t.title).toBe(VAULT_TEXT.en.title);
  });
  it("uses every text key it needs", () => { const used = new Set([...VAULT_UI_SRC.matchAll(/\bT\.([a-z_0-9]+)/g)].map((m) => m[1])); for (const k of used) expect(VAULT_TEXT.en[k], k).toBeTruthy(); for (const k of ["passport", "evoa", "insurance", "booking", "ticket", "other"]) expect(VAULT_TEXT.en[`type_${k}`]).toBeTruthy(); });
});

describe("the bilingual health card", () => {
  it("has an English and a Thai name for every choice, with unique ids and Thai letters", () => {
    for (const list of [ALLERGIES, CONDITIONS, BLOOD]) { expect(new Set(list.map((o) => o.id)).size).toBe(list.length); for (const o of list) { expect(o.en).toBeTruthy(); expect(o.th).toMatch(/[฀-๿]/); } }
    for (const pair of Object.values(HEALTH_LABELS)) { expect(pair[0]).toBeTruthy(); expect(pair[1]).toMatch(/[฀-๿]/); }
  });
  it("is cleaned: unknown choices dropped, text cut, phone numbers kept to digits", () => {
    const d = cleanHealth({ name: "  Anna   K  ", dob: "1990-05-01", blood: "O+", allergies: ["penicillin", "pizza", "penicillin"], conditions: ["asthma", 5], meds: "x".repeat(900), contacts: [{ name: "Bo", phone: "+66 81-234 <b>5678</b>", rel: "Friend" }], allergyOther: "<script>" });
    expect(d).toMatchObject({ name: "Anna K", dob: "1990-05-01", blood: "O+", allergies: ["penicillin"], conditions: ["asthma"] }); expect(d.meds).toHaveLength(400); expect(d.contacts[0].phone).toBe("+66 81-234 5678");
    expect(cleanHealth({ dob: "tomorrow", blood: "Z" })).toMatchObject({ dob: "", blood: "" }); expect(cleanHealth(null)).toEqual(emptyHealth());
    expect(hasHealthData(emptyHealth())).toBe(false); expect(hasHealthData(d)).toBe(true);
  });
});
