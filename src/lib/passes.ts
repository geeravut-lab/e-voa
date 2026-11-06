import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { envValue } from "@/lib/env";

// The QR on an E-VOA pass points to /v/<token>. The token is the application id plus a signature, so nobody can invent a valid one,
// and the page behind it shows only the minimum (status, first name, dates).
const key = () => {
  const raw = Buffer.from(envValue("DATA_ENCRYPTION_KEY"), "base64");
  if (raw.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return Buffer.from(hkdfSync("sha256", raw, Buffer.alloc(0), "thaipass:pass-token", 32));
};
const sig = (id: string) => createHmac("sha256", key()).update(id).digest("base64url").slice(0, 22);

export const passToken = (applicationId: string) => `${applicationId}.${sig(applicationId)}`;

/** Returns the application id when the signature is right, otherwise null. */
export function verifyPassToken(token: string): string | null {
  const [id, s] = token.split(".");
  if (!id || !s || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = sig(id);
  return s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)) ? id : null;
}
