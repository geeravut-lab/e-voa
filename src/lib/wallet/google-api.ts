import "server-only";
import { createSign } from "node:crypto";
import { envValue } from "@/lib/env";
import { buildPayload, objectIdFor, type WalletConfig, type WalletPass } from "./google";

// Updating a pass that is already in a traveler's wallet: a PATCH to the Google Wallet API, signed in as the service account.
// The two addresses can be overridden for tests (the simulator); the real ones are fixed in code.
const tokenUrl = () => envValue("GOOGLE_WALLET_TOKEN_URL") || "https://oauth2.googleapis.com/token";
const apiBase = () => (envValue("GOOGLE_WALLET_API_URL") || "https://walletobjects.googleapis.com").replace(/\/$/, "");
const b64u = (s: string) => Buffer.from(s).toString("base64url");

export async function accessToken(c: WalletConfig, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: c.email, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: tokenUrl(), iat: now, exp: now + 3000 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(c.privateKey, "base64url");
  const res = await fetch(tokenUrl(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const j = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !j?.access_token) throw new Error(`google wallet token ${res.status}`);
  return j.access_token;
}

/** Sends the pass's current content. "missing" = nobody has saved this pass yet (Google answers 404): nothing to update. */
export async function patchObject(c: WalletConfig, p: WalletPass, active: boolean): Promise<"updated" | "missing"> {
  const { id: _id, classId: _classId, ...fields } = buildPayload(c, p, active).genericObjects[0];
  const res = await fetch(`${apiBase()}/walletobjects/v1/genericObject/${encodeURIComponent(objectIdFor(c, p.ref))}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${await accessToken(c)}`, "Content-Type": "application/json" }, body: JSON.stringify(fields), signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  if (res.status === 404) return "missing";
  if (!res.ok) throw new Error(`google wallet patch ${res.status}`);
  return "updated";
}
