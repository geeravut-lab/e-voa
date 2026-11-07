import { afterEach, describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { buildPayload, normalizeKey, objectIdFor, saveUrl, signSaveJwt, walletConfig, type WalletPass } from "@/lib/wallet/google";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ENV = ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", "GOOGLE_WALLET_PRIVATE_KEY", "GOOGLE_WALLET_CLASS_ID", "GOOGLE_WALLET_BG_COLOR"];
const setEnv = (o: Record<string, string>) => { for (const k of ENV) delete process.env[k]; Object.assign(process.env, o); };
afterEach(() => setEnv({}));
const good = { GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "wallet@proj.iam.gserviceaccount.com", GOOGLE_WALLET_PRIVATE_KEY: privateKey };
const pass: WalletPass = { ref: "EV-26-000116", name: "Ada Lovelace", brand: "ThaiPass e-VOA", lang: "en", arrival: "1 December 2026", flight: "TG921", passportLast4: "4567", status: "Approved", verifyUrl: "https://e-voa.example/v/abc.def", logoUrl: "https://e-voa.example/brand/logo",
  labels: { ref: "Reference", arrival: "Arrival", flight: "Flight", passport: "Passport", check: "Check status", title: "E-VOA pass", notGov: "Private service", status: "Approved" } };

describe("Google Wallet setup", () => {
  it("is off until every value is present and well formed", () => {
    setEnv({}); expect(walletConfig("https://e-voa.example")).toBeNull();
    setEnv({ ...good, GOOGLE_WALLET_ISSUER_ID: "abc" }); expect(walletConfig("https://x")).toBeNull();
    setEnv({ ...good, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "null" }); expect(walletConfig("https://x")).toBeNull();                      // "null" typed into Vercel means not set
    setEnv({ ...good, GOOGLE_WALLET_PRIVATE_KEY: "not a key" }); expect(walletConfig("https://x")).toBeNull();
    setEnv({ ...good, GOOGLE_WALLET_CLASS_ID: "bad class!" }); expect(walletConfig("https://x")).toBeNull();
    setEnv(good); expect(walletConfig("https://x")).toMatchObject({ issuerId: "3388000000012345678", classSuffix: "evoa_pass", origin: "https://x" });
  });
  it("accepts a private key pasted on one line with \\n and a custom background only when it is a hex color", () => {
    setEnv({ ...good, GOOGLE_WALLET_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n"), GOOGLE_WALLET_BG_COLOR: "#112233" });
    const c = walletConfig("https://x")!; expect(c.privateKey).toBe(normalizeKey(privateKey)); expect(c.background).toBe("#112233");
    setEnv({ ...good, GOOGLE_WALLET_BG_COLOR: "red" }); expect(walletConfig("https://x")!.background).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("the save link", () => {
  setEnv(good);
  const c = () => { setEnv(good); return walletConfig("https://e-voa.example")!; };
  it("is a JWT signed with the service account key that Google can verify with the public key", () => {
    const [h, b, s] = signSaveJwt(c(), pass, 1_800_000_000).split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, s, "base64url")).toBe(true);
    const claims = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(claims).toMatchObject({ iss: "wallet@proj.iam.gserviceaccount.com", aud: "google", typ: "savetowallet", iat: 1_800_000_000, origins: ["https://e-voa.example"] });
  });
  it("is tampering-evident: changing the body breaks the signature", () => {
    const [h, , s] = signSaveJwt(c(), pass).split("."), fake = Buffer.from(JSON.stringify({ iss: "evil" })).toString("base64url");
    expect(createVerify("RSA-SHA256").update(`${h}.${fake}`).verify(publicKey, s, "base64url")).toBe(false);
  });
  it("builds a Generic pass with the QR, the reference, only the last four passport characters and the private-service notice", () => {
    const o = buildPayload(c(), pass).genericObjects[0];
    expect(o.id).toBe("3388000000012345678.EV-26-000116"); expect(o.classId).toBe("3388000000012345678.evoa_pass"); expect(o.state).toBe("ACTIVE");
    expect(o.barcode).toEqual({ type: "QR_CODE", value: pass.verifyUrl, alternateText: "EV-26-000116" });
    const text = JSON.stringify(o); expect(text).toContain("••••4567"); expect(text).toContain("Private service");
    expect(o.textModulesData.map((m) => m.id)).toEqual(["status", "ref", "arrival", "flight", "passport", "notice"]);
  });
  it("leaves out what is unknown and cleans the object id", () => {
    const o = buildPayload(c(), { ...pass, arrival: null, flight: null, passportLast4: null }).genericObjects[0];
    expect(o.textModulesData.map((m) => m.id)).toEqual(["status", "ref", "notice"]);
    expect(objectIdFor(c(), "EV 26/1")).toBe("3388000000012345678.EV_26_1");
  });
  it("opens at pay.google.com/gp/v/save", () => { expect(saveUrl(c(), pass)).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\/[\w-]+\.[\w-]+\.[\w-]+$/); });
});
