import "server-only";
import http2 from "node:http2";
import sharp from "sharp";
import { PKPass } from "passkit-generator";
import { envValue } from "@/lib/env";
import { THEME_COLOR } from "@/config/theme";
import { loadBrand, readBrandFile } from "@/lib/brand/server";
import type { PassContent } from "./content";

export type AppleConfig = { passTypeId: string; teamId: string; cert: string; key: string; passphrase?: string; wwdr: string; origin: string; background: string };

/** A PEM pasted into a one-line field has "\n" as two characters; a base64 copy of the PEM file is accepted too. */
export function pemOf(raw: string): string {
  const v = raw.replace(/\\n/g, "\n").trim();
  if (v.includes("-----BEGIN")) return v;
  try { const d = Buffer.from(v, "base64").toString("utf8"); return d.includes("-----BEGIN") ? d.trim() : ""; } catch { return ""; }
}
const hexToRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };

/** null = Apple Wallet is not set up (the button is not shown). */
export function appleConfig(origin: string): AppleConfig | null {
  const passTypeId = envValue("APPLE_WALLET_PASS_TYPE_ID"), teamId = envValue("APPLE_WALLET_TEAM_ID");
  const cert = pemOf(envValue("APPLE_WALLET_CERT")), key = pemOf(envValue("APPLE_WALLET_KEY")), wwdr = pemOf(envValue("APPLE_WALLET_WWDR"));
  if (!/^pass\.[A-Za-z0-9.-]{3,100}$/.test(passTypeId) || !/^[A-Z0-9]{10}$/.test(teamId) || !cert || !key || !wwdr) return null;
  const bg = envValue("APPLE_WALLET_BG_COLOR");
  return { passTypeId, teamId, cert, key, passphrase: envValue("APPLE_WALLET_KEY_PASSPHRASE") || undefined, wwdr, origin, background: /^#[0-9A-Fa-f]{6}$/.test(bg) ? bg : THEME_COLOR };
}

/** The brand logo as a PNG (the admin's own image, else a plain mark in the theme color). */
async function brandPng(width: number, height: number): Promise<Buffer> {
  try {
    const image = (await loadBrand()).logo;
    const bytes = image ? await readBrandFile("logo", image) : null;
    if (bytes) return await sharp(Buffer.from(bytes)).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  } catch (e) { console.error("[wallet] brand image unusable", (e as Error).message); }
  const s = Math.min(width, height);
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${THEME_COLOR}"/><path d="M27 52l16 16 31-34" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return sharp(Buffer.from(mark)).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** The .pkpass file: signed with the Pass Type ID certificate; the phone asks `webServiceURL` for newer versions (see service.ts). */
export async function buildApplePass(c: AppleConfig, p: PassContent, serial: string, authToken: string, arrivalIso: string | null): Promise<Buffer> {
  const [i1, i2, i3, l1, l2] = await Promise.all([brandPng(29, 29), brandPng(58, 58), brandPng(87, 87), brandPng(160, 50), brandPng(320, 100)]);
  const pass = new PKPass({ "icon.png": i1, "icon@2x.png": i2, "icon@3x.png": i3, "logo.png": l1, "logo@2x.png": l2 },
    { wwdr: c.wwdr, signerCert: c.cert, signerKey: c.key, signerKeyPassphrase: c.passphrase },
    { formatVersion: 1, serialNumber: serial, passTypeIdentifier: c.passTypeId, teamIdentifier: c.teamId, organizationName: p.brand, description: p.labels.title, logoText: p.brand,
      webServiceURL: `${c.origin}/api/wallet/apple`, authenticationToken: authToken, backgroundColor: hexToRgb(c.background), foregroundColor: "rgb(255, 255, 255)", labelColor: "rgb(255, 255, 255)",
      voided: !p.active });
  pass.type = "generic";
  if (arrivalIso) pass.setRelevantDates([{ date: new Date(`${arrivalIso}T00:00:00+07:00`).toISOString() }]);          // the lock screen shows the pass near the arrival day
  pass.primaryFields.push({ key: "name", label: p.labels.title, value: p.name });
  pass.secondaryFields.push({ key: "ref", label: p.labels.ref, value: p.ref }, ...(p.arrival ? [{ key: "arrival", label: p.labels.arrival, value: p.arrival }] : []));
  pass.auxiliaryFields.push({ key: "status", label: p.labels.status, value: p.status }, ...(p.flight ? [{ key: "flight", label: p.labels.flight, value: p.flight }] : []), ...(p.passportLast4 ? [{ key: "passport", label: p.labels.passport, value: `••••${p.passportLast4}` }] : []));
  pass.backFields.push({ key: "notice", label: p.brand, value: p.labels.notGov }, { key: "check", label: p.labels.check, value: p.verifyUrl });
  pass.setBarcodes({ message: p.verifyUrl, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: p.ref });
  return pass.getAsBuffer();
}

/** Tells phones that a pass changed: an empty push per device token; the phone then asks our web service for the new file. Returns how many were accepted. */
export async function applePush(c: AppleConfig, tokens: string[], opts: { url?: string; ca?: string } = {}): Promise<{ sent: number; failed: number }> {
  if (!tokens.length) return { sent: 0, failed: 0 };
  const client = http2.connect(opts.url ?? (envValue("APPLE_APNS_URL") || "https://api.push.apple.com"), { cert: c.cert, key: c.key, passphrase: c.passphrase, ...((opts.ca ?? envValue("APPLE_APNS_CA")) ? { ca: pemOf(opts.ca ?? envValue("APPLE_APNS_CA")) } : {}) });
  let sent = 0, failed = 0;
  try {
    await new Promise<void>((resolve, reject) => { client.once("connect", () => resolve()); client.once("error", reject); });
    await Promise.all(tokens.map((token) => new Promise<void>((resolve) => {
      const req = client.request({ ":method": "POST", ":path": `/3/device/${token}`, "apns-topic": c.passTypeId, "content-type": "application/json" });
      req.setTimeout(10_000, () => { failed++; req.close(); resolve(); });
      req.on("response", (h) => { if (h[":status"] === 200) sent++; else failed++; });
      req.on("error", () => { failed++; resolve(); }); req.on("close", () => resolve()); req.resume();
      req.end("{}");
    })));
  } catch (e) { console.error("[wallet] apple push failed", (e as Error).message); failed += tokens.length - sent - failed; }
  finally { client.close(); }
  return { sent, failed };
}
