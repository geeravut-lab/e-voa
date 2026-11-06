import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { envValue } from "@/lib/env";

const base = () => (envValue("LINE_API_URL") || "https://api.line.me").replace(/\/$/, "");
const headers = () => ({ Authorization: `Bearer ${envValue("LINE_CHANNEL_ACCESS_TOKEN")}`, "Content-Type": "application/json" });

/** LINE signs every webhook call: base64(HMAC-SHA256(channel secret, raw body)) in X-Line-Signature. Compared in constant time. */
export function verifyLineSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("base64");
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export type SendResult = { ok: true } | { ok: false; error: string; permanent: boolean };

export async function linePush(to: string, text: string): Promise<SendResult> {
  try {
    const res = await fetch(`${base()}/v2/bot/message/push`, { method: "POST", headers: headers(), body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }), signal: AbortSignal.timeout(10_000) });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: `LINE ${res.status}: ${(j.message ?? "").slice(0, 120)}`, permanent: res.status === 400 || res.status === 403 };   // blocked / not a friend: do not keep trying
  } catch (e) { return { ok: false, error: `LINE unreachable: ${(e as Error).message}`.slice(0, 160), permanent: false }; }
}
export async function lineReply(replyToken: string, text: string): Promise<void> {
  try { await fetch(`${base()}/v2/bot/message/reply`, { method: "POST", headers: headers(), body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 900) }] }), signal: AbortSignal.timeout(10_000) }); } catch { /* the link already worked; the confirmation is a courtesy */ }
}
