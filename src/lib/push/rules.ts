// Web Push input checks. PURE (no server imports) so the tests and the server share them.
// The server will POST to whatever endpoint it is given, so only the push services of the big browsers are accepted: an address chosen by a user must never make the server call an arbitrary host.
const HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^updates-autopush\.stage\.mozaws\.net$/,
];
export type PushSub = { endpoint: string; p256dh: string; auth: string };
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function endpointAllowed(endpoint: string): boolean {
  try { const u = new URL(endpoint); return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && HOSTS.some((h) => h.test(u.hostname)); } catch { return false; }
}
/** A subscription as the browser gives it (PushSubscription.toJSON()). Returns null for anything that does not look right. */
export function parseSubscription(raw: unknown): PushSub | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof o.endpoint === "string" ? o.endpoint : "", p256dh = o.keys?.p256dh, auth = o.keys?.auth;
  if (endpoint.length > 600 || !endpointAllowed(endpoint)) return null;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length < 40 || p256dh.length > 140 || auth.length < 8 || auth.length > 40 || !B64URL.test(p256dh) || !B64URL.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };
/** What the phone shows. The link must be a path on this site; the text is cut to a size a lock screen can show. */
export function buildPayload(n: { title: string; body?: string; link?: string; kind?: string; dedupeKey?: string }): PushPayload {
  const link = n.link && n.link.startsWith("/") && !n.link.startsWith("//") && !n.link.includes("\\") ? n.link : "/notifications";
  return { title: n.title.slice(0, 80), body: (n.body ?? "").slice(0, 160), url: link.slice(0, 200), tag: (n.dedupeKey ?? n.kind ?? "notice").slice(0, 60) };
}
/** Which answers from the push service mean "this subscription is gone for good". */
export const isGone = (status: number) => status === 404 || status === 410;
