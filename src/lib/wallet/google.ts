// Google Wallet "Save to Wallet" link for the E-VOA pass. The link carries a JWT signed with the service account's private key (RS256), so the pass is created
// when the traveler taps it: no call to Google is made from our server and the key never leaves it. Pure except for reading the environment.
import { createSign } from "node:crypto";
import { envValue } from "@/lib/env";
import { THEME_COLOR } from "@/config/theme";

export type WalletConfig = { issuerId: string; email: string; privateKey: string; classSuffix: string; origin: string; background: string };
export type WalletPass = { ref: string; name: string; brand: string; lang: string; arrival: string | null; flight: string | null; passportLast4: string | null; verifyUrl: string; logoUrl: string; labels: { ref: string; arrival: string; flight: string; passport: string; check: string; title: string; notGov: string } };

/** A private key pasted into a one-line environment field keeps "\n" as two characters: turn them back into line breaks. */
export const normalizeKey = (k: string) => k.replace(/\\n/g, "\n").trim();
const ID_PART = /^[A-Za-z0-9._-]{1,60}$/;

/** null = Google Wallet is not set up (the button is simply not shown). Any missing or malformed value counts as "not set up". */
export function walletConfig(origin: string): WalletConfig | null {
  const issuerId = envValue("GOOGLE_WALLET_ISSUER_ID"), email = envValue("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL"), privateKey = normalizeKey(envValue("GOOGLE_WALLET_PRIVATE_KEY"));
  const classSuffix = envValue("GOOGLE_WALLET_CLASS_ID") || "evoa_pass";
  if (!/^\d{5,30}$/.test(issuerId) || !/^[^@\s]+@[^@\s]+$/.test(email) || !/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey) || !ID_PART.test(classSuffix)) return null;
  const bg = envValue("GOOGLE_WALLET_BG_COLOR");
  return { issuerId, email, privateKey, classSuffix, origin, background: /^#[0-9A-Fa-f]{6}$/.test(bg) ? bg : THEME_COLOR };
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
/** Object ids may contain only letters, digits, "." "_" "-": the reference EV-26-000116 already does, anything else is replaced. */
export const objectIdFor = (c: WalletConfig, ref: string) => `${c.issuerId}.${ref.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60)}`;

export function buildPayload(c: WalletConfig, p: WalletPass) {
  const text = (value: string) => ({ defaultValue: { language: p.lang, value } });
  const modules = [
    { id: "ref", header: p.labels.ref, body: p.ref },
    ...(p.arrival ? [{ id: "arrival", header: p.labels.arrival, body: p.arrival }] : []),
    ...(p.flight ? [{ id: "flight", header: p.labels.flight, body: p.flight }] : []),
    ...(p.passportLast4 ? [{ id: "passport", header: p.labels.passport, body: `••••${p.passportLast4}` }] : []),     // never more than the last four characters
    { id: "notice", body: p.labels.notGov },
  ];
  return {
    genericClasses: [{ id: `${c.issuerId}.${c.classSuffix}` }],
    genericObjects: [{
      id: objectIdFor(c, p.ref), classId: `${c.issuerId}.${c.classSuffix}`, state: "ACTIVE", hexBackgroundColor: c.background,
      logo: { sourceUri: { uri: p.logoUrl }, contentDescription: text(p.brand) },
      cardTitle: text(p.brand), header: text(p.name), subheader: text(p.labels.title),
      barcode: { type: "QR_CODE", value: p.verifyUrl, alternateText: p.ref },
      textModulesData: modules, linksModuleData: { uris: [{ uri: p.verifyUrl, description: p.labels.check, id: "status" }] },
    }],
  };
}

/** The signed token inside the link. `now` is injectable for tests. */
export function signSaveJwt(c: WalletConfig, p: WalletPass, now = Math.floor(Date.now() / 1000)): string {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: c.email, aud: "google", typ: "savetowallet", iat: now, origins: [c.origin], payload: buildPayload(c, p) }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(c.privateKey, "base64url");
  return `${head}.${body}.${sig}`;
}
export const saveUrl = (c: WalletConfig, p: WalletPass) => `https://pay.google.com/gp/v/save/${signSaveJwt(c, p)}`;
