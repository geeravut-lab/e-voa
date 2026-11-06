import { createHmac, timingSafeEqual } from "node:crypto";
import { envValue } from "@/lib/env";

// Stripe over plain REST (no SDK): Checkout Sessions, refunds, webhook signatures. TEST keys (sk_test_…) for now; the code is identical for live keys.
const BASE = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

type Param = string | number | boolean | undefined | null | Param[] | { [k: string]: Param };

/** Stripe wants form fields with brackets: line_items[0][price_data][currency]=thb */
export function formEncode(obj: { [k: string]: Param }): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, v: Param) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(`${prefix}[${k}]`, x);
    else out.append(prefix, String(v));
  };
  for (const [k, v] of Object.entries(obj)) walk(k, v);
  return out.toString();
}

export const stripeConfigured = () => Boolean(envValue("STRIPE_SECRET_KEY"));

async function call<T>(method: "GET" | "POST", path: string, body?: { [k: string]: Param }, idempotencyKey?: string): Promise<T> {
  const key = envValue("STRIPE_SECRET_KEY");
  if (!key) throw new StripeError("STRIPE_SECRET_KEY is not set", 0, "not_configured");
  const url = method === "GET" && body ? `${BASE}${path}?${formEncode(body)}` : `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: method === "POST" && body ? formEncode(body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: string } }) | null;
  if (!res.ok || !json) throw new StripeError(json?.error?.message ?? `Stripe answered ${res.status}`, res.status, json?.error?.code);
  return json;
}

export type CheckoutSession = {
  id: string; url: string | null; status: "open" | "complete" | "expired"; payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null; currency: string | null; client_reference_id: string | null; metadata: Record<string, string>;
  payment_intent: string | { id: string } | null; livemode: boolean; expires_at: number;
};

export const paymentIntentId = (s: CheckoutSession) => (typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null);

export function createCheckoutSession(a: { paymentId: string; items: { label: string; amountSatang: number }[]; email?: string | null; successUrl: string; cancelUrl: string; locale?: string; minutesToExpire?: number }) {
  return call<CheckoutSession>("POST", "/checkout/sessions", {
    mode: "payment",
    client_reference_id: a.paymentId,
    customer_email: a.email ?? undefined,
    success_url: a.successUrl,
    cancel_url: a.cancelUrl,
    locale: a.locale ?? "auto",
    expires_at: Math.floor(Date.now() / 1000) + Math.max(30, a.minutesToExpire ?? 60) * 60,
    metadata: { payment_id: a.paymentId },
    payment_intent_data: { metadata: { payment_id: a.paymentId } },
    line_items: a.items.map((i) => ({ quantity: 1, price_data: { currency: "thb", unit_amount: i.amountSatang, product_data: { name: i.label.slice(0, 120) } } })),
  }, `checkout:${a.paymentId}`);
}

export const retrieveSession = (id: string) => call<CheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, { "expand": ["payment_intent"] });
export const expireSession = (id: string) => call<CheckoutSession>("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`, {});

export type Refund = { id: string; status: "pending" | "succeeded" | "failed" | "canceled" | "requires_action"; amount: number; currency: string; payment_intent: string };
export const createRefund = (a: { paymentIntent: string; amountSatang: number; reason: string; idempotencyKey: string }) =>
  call<Refund>("POST", "/refunds", { payment_intent: a.paymentIntent, amount: a.amountSatang, metadata: { reason: a.reason.slice(0, 200) } }, a.idempotencyKey);

// ---- webhooks
export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** Checks "Stripe-Signature: t=…,v1=…" against the raw body. Throws if the signature is wrong or the message is too old (replay). */
export function verifyWebhook(rawBody: string, header: string | null, secret: string, now = Date.now(), toleranceSec = 300): StripeEvent {
  if (!header || !secret) throw new StripeError("missing signature", 400, "no_signature");
  const parts = Object.fromEntries(header.split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1)]; }));
  const t = Number(parts.t);
  const candidates = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  if (!Number.isFinite(t) || candidates.length === 0) throw new StripeError("bad signature header", 400, "bad_header");
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new StripeError("signature too old", 400, "stale");
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const ok = candidates.some((c) => c.length === expected.length && timingSafeEqual(Buffer.from(c), Buffer.from(expected)));
  if (!ok) throw new StripeError("signature mismatch", 400, "mismatch");
  return JSON.parse(rawBody) as StripeEvent;
}

/** For tests and local tools: builds a valid header for a body. */
export const signWebhook = (rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
