import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole, envValue } from "@/lib/env";
import { verifyWebhook, StripeError } from "@/lib/payments/stripe";
import { confirmPayment, failPayment } from "@/lib/payments/service";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Stripe → ThaiPass. The body is only used to learn WHICH payment to look at: the money is confirmed by asking Stripe again (confirmPayment),
 * so a forged or replayed message cannot approve anything. Each event id is handled once.
 */
export async function POST(req: NextRequest) {
  const secret = envValue("STRIPE_WEBHOOK_SECRET");
  if (!secret || !hasServiceRole()) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const raw = await req.text();                                           // the exact bytes: the signature covers them
  let event;
  try { event = verifyWebhook(raw, req.headers.get("stripe-signature"), secret); }
  catch (e) { return NextResponse.json({ error: e instanceof StripeError ? e.message : "bad request" }, { status: 400 }); }

  const db = createAdminClient();
  const seen = await db.from("payment_events").insert({ provider: "stripe", event_id: event.id, type: event.type }).select("id");
  if (seen.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (seen.error) { console.error("[stripe] event log failed", seen.error.message); return NextResponse.json({ error: "try again" }, { status: 500 }); }

  const obj = event.data.object as { id?: string; client_reference_id?: string | null; metadata?: Record<string, string> };
  const paymentId = obj.client_reference_id ?? obj.metadata?.payment_id;
  try {
    if (paymentId && ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const r = await confirmPayment(paymentId, obj.id);
      if (!r.ok && r.error === "stripe") throw new Error("Stripe lookup failed");   // 500 → Stripe will send it again
    } else if (paymentId && ["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      await failPayment(paymentId, event.type);
    }
  } catch (e) {
    await db.from("payment_events").delete().eq("provider", "stripe").eq("event_id", event.id);     // allow the retry to be processed
    console.error("[stripe] webhook handling failed", (e as Error).message);
    await audit({ actorId: null, actorRole: "system", action: "payment.webhook_error", entity: "payment", detail: { type: event.type.slice(0, 40) } });
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
