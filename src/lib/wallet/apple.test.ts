import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/brand/server", () => ({ loadBrand: async () => ({ name: "ThaiPass e-VOA", logo: null }), readBrandFile: async () => null }));
import http2 from "node:http2";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appleConfig, applePush, buildApplePass, pemOf } from "@/lib/wallet/apple";
import type { PassContent } from "@/lib/wallet/content";
import { makeTestCerts, readZip } from "../../../tests-live/wallet-certs";

const certs = makeTestCerts();
const ENV = ["APPLE_WALLET_PASS_TYPE_ID", "APPLE_WALLET_TEAM_ID", "APPLE_WALLET_CERT", "APPLE_WALLET_KEY", "APPLE_WALLET_WWDR", "APPLE_WALLET_KEY_PASSPHRASE", "APPLE_WALLET_BG_COLOR"];
const setEnv = (o: Record<string, string>) => { for (const k of ENV) delete process.env[k]; Object.assign(process.env, o); };
const good = { APPLE_WALLET_PASS_TYPE_ID: "pass.test.evoa", APPLE_WALLET_TEAM_ID: "ABCDE12345", APPLE_WALLET_CERT: certs.signerCert, APPLE_WALLET_KEY: certs.signerKey, APPLE_WALLET_WWDR: certs.wwdr };
const content: PassContent = { applicationId: "a1", active: true, arrivalIso: "2026-12-01", ref: "EV-26-000116", name: "Ada Lovelace", brand: "ThaiPass e-VOA", lang: "en", arrival: "1 December 2026", flight: "TG921", passportLast4: "4567", status: "Approved",
  verifyUrl: "https://e-voa.example/v/abc.def", logoUrl: "https://e-voa.example/brand/logo", labels: { ref: "Reference", arrival: "Arrival", flight: "Flight", passport: "Passport", check: "Check status", title: "E-VOA pass", notGov: "Private service, not a government document.", status: "Status" } };

describe("Apple Wallet setup", () => {
  it("is off until the pass type, team and the three certificates are present and well formed", () => {
    setEnv({}); expect(appleConfig("https://x")).toBeNull();
    setEnv({ ...good, APPLE_WALLET_PASS_TYPE_ID: "com.bad" }); expect(appleConfig("https://x")).toBeNull();
    setEnv({ ...good, APPLE_WALLET_TEAM_ID: "short" }); expect(appleConfig("https://x")).toBeNull();
    setEnv({ ...good, APPLE_WALLET_CERT: "garbage" }); expect(appleConfig("https://x")).toBeNull();
    setEnv(good); expect(appleConfig("https://x")).toMatchObject({ passTypeId: "pass.test.evoa", teamId: "ABCDE12345", origin: "https://x" });
  });
  it("accepts PEM with \\n, or the PEM file encoded as base64", () => {
    expect(pemOf(certs.wwdr.replace(/\n/g, "\\n"))).toBe(certs.wwdr.trim()); expect(pemOf(Buffer.from(certs.wwdr).toString("base64"))).toBe(certs.wwdr.trim()); expect(pemOf("nope")).toBe("");
  });
});

describe("the .pkpass file", () => {
  setEnv(good);
  it("is a signed bundle: manifest hashes match every file, the signature verifies against the manifest, and pass.json carries what the traveler sees", async () => {
    setEnv(good); const cfg = appleConfig("https://e-voa.example")!;
    const zip = readZip(await buildApplePass(cfg, content, "evoa-EV-26-000116", "tok-123456789012345678", "2026-12-01"));
    for (const f of ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"]) expect(zip.has(f), f).toBe(true);
    const manifest = JSON.parse(zip.get("manifest.json")!.toString()) as Record<string, string>;
    for (const [name, sha] of Object.entries(manifest)) expect(createHash("sha1").update(zip.get(name)!).digest("hex"), name).toBe(sha);
    expect(Object.keys(manifest).sort()).toEqual([...zip.keys()].filter((k) => k !== "manifest.json" && k !== "signature").sort());
    const d = mkdtempSync(join(tmpdir(), "pk-"));
    try {
      writeFileSync(join(d, "m.json"), zip.get("manifest.json")!); writeFileSync(join(d, "sig"), zip.get("signature")!); writeFileSync(join(d, "ca.pem"), certs.wwdr);
      execFileSync("openssl", ["smime", "-verify", "-inform", "DER", "-in", join(d, "sig"), "-content", join(d, "m.json"), "-binary", "-noverify", "-out", join(d, "out")], { stdio: "pipe" });        // throws if the signature is wrong
      writeFileSync(join(d, "m.json"), Buffer.concat([zip.get("manifest.json")!, Buffer.from(" ")]));
      expect(() => execFileSync("openssl", ["smime", "-verify", "-inform", "DER", "-in", join(d, "sig"), "-content", join(d, "m.json"), "-binary", "-noverify", "-out", join(d, "out2")], { stdio: "pipe" })).toThrow();   // a changed manifest breaks it
    } finally { rmSync(d, { recursive: true, force: true }); }
    const pass = JSON.parse(zip.get("pass.json")!.toString());
    expect(pass).toMatchObject({ serialNumber: "evoa-EV-26-000116", passTypeIdentifier: "pass.test.evoa", teamIdentifier: "ABCDE12345", organizationName: "ThaiPass e-VOA", webServiceURL: "https://e-voa.example/api/wallet/apple", authenticationToken: "tok-123456789012345678" });
    expect(pass.voided).toBeFalsy(); expect(pass.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: content.verifyUrl, altText: "EV-26-000116" }); expect(pass.relevantDates[0].relevantDate).toBe("2026-11-30T17:00:00.000Z");
    const text = JSON.stringify(pass.generic); expect(text).toContain("Ada Lovelace"); expect(text).toContain("••••4567"); expect(text).toContain("Private service");
    expect(pass.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
  it("marks the pass void when the application is no longer approved", async () => {
    setEnv(good); const zip = readZip(await buildApplePass(appleConfig("https://x")!, { ...content, active: false, status: "Cancelled" }, "s", "tok-123456789012345678", null));
    const pass = JSON.parse(zip.get("pass.json")!.toString()); expect(pass.voided).toBe(true); expect(pass.relevantDates).toBeUndefined(); expect(JSON.stringify(pass.generic)).toContain("Cancelled");
  });
});

describe("push to a phone", () => {
  it("sends an empty notification per device token to Apple's push service, for the pass type, over HTTP/2 with the pass certificate", async () => {
    setEnv(good); const cfg = appleConfig("https://x")!, seen: { path?: string; topic?: unknown; body: string; cert: boolean }[] = [];
    const server = http2.createSecureServer({ cert: certs.serverCert, key: certs.serverKey, requestCert: true, rejectUnauthorized: false });
    server.on("stream", (stream, headers) => {
      let body = ""; stream.on("data", (c) => (body += c));
      stream.on("end", () => { seen.push({ path: String(headers[":path"]), topic: headers["apns-topic"], body, cert: !!(stream.session?.socket as unknown as { getPeerCertificate?: () => { subject?: unknown } })?.getPeerCertificate?.()?.subject }); stream.respond({ ":status": String(headers[":path"]).endsWith("bad") ? 410 : 200 }); stream.end(); });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const url = `https://127.0.0.1:${(server.address() as { port: number }).port}`;
      expect(await applePush(cfg, ["aabbccddeeff0011", "bad"], { url, ca: certs.serverCert })).toEqual({ sent: 1, failed: 1 });
      expect(seen.map((s) => s.path).sort()).toEqual(["/3/device/aabbccddeeff0011", "/3/device/bad"]); expect(seen.every((s) => s.topic === "pass.test.evoa" && s.body === "{}" && s.cert)).toBe(true);
      expect(await applePush(cfg, [], { url })).toEqual({ sent: 0, failed: 0 });
    } finally { await new Promise((r) => server.close(r)); }
  });
  it("reports failure (not a crash) when Apple cannot be reached", async () => {
    setEnv(good); expect(await applePush(appleConfig("https://x")!, ["aabbccddeeff0011"], { url: "https://127.0.0.1:1" })).toEqual({ sent: 0, failed: 1 });
  });
});
