import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { envValue } from "@/lib/env";

/**
 * Application-level encryption for passport numbers and document files (on top of the storage provider's own encryption at rest).
 * AES-256-GCM, random 12-byte nonce per item, versioned header so keys can be rotated later.
 *   layout: [1 byte version][12 bytes nonce][ciphertext][16 bytes auth tag]
 * One master key in DATA_ENCRYPTION_KEY (base64, 32 bytes); the keyed hash uses a separate key derived from it.
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export const ENC_VERSION = 1;

export class CryptoConfigError extends Error {}

function masterKey(): Buffer {
  const raw = envValue("DATA_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new CryptoConfigError("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}
const derive = (label: string) => Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), `thaipass:${label}`, 32));

export function encryptBytes(plain: Uint8Array): Buffer {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", derive("data"), nonce);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from([ENC_VERSION]), nonce, body, c.getAuthTag()]);
}

export function decryptBytes(blob: Uint8Array): Buffer {
  const b = Buffer.from(blob);
  if (b.length < 1 + 12 + 16) throw new Error("ciphertext too short");
  if (b[0] !== ENC_VERSION) throw new Error(`unsupported encryption version ${b[0]}`);
  const d = createDecipheriv("aes-256-gcm", derive("data"), b.subarray(1, 13));
  d.setAuthTag(b.subarray(b.length - 16));
  return Buffer.concat([d.update(b.subarray(13, b.length - 16)), d.final()]);   // throws if anything was changed
}

export const encryptText = (s: string) => encryptBytes(Buffer.from(s, "utf8")).toString("base64");
export const decryptText = (s: string) => decryptBytes(Buffer.from(s, "base64")).toString("utf8");

/** Normalised form used for comparing identifiers: letters upper-cased, spaces and dashes removed. */
export const normalizeId = (s: string) => s.toUpperCase().replace(/[\s-]+/g, "");

/** Keyed hash of an identifier (passport number): lets us find duplicates without keeping the number readable. */
export const hashId = (s: string) => createHmac("sha256", derive("id-hash")).update(normalizeId(s)).digest("hex");

export const last4 = (s: string) => normalizeId(s).slice(-4);
export const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
