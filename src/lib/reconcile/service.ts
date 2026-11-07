import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeConfigured, listPaymentIntents, listStripeRefunds, paymentIntentExists, refundExists, type StripeIntentRaw, type StripeRefundRaw } from "@/lib/payments/stripe";
import { notifyUser } from "@/lib/notify";
import { DICTS } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import { fmt } from "@/lib/i18n/dict";
import { reconcile, thaiDayRange, yesterdayThai, isPaidStatus, type Report } from "./rules";

const db = () => createAdminClient();
export type StripeSide = { intents: (fromSec: number, toSec: number) => Promise<StripeIntentRaw[]>; refunds: (fromSec: number, toSec: number) => Promise<StripeRefundRaw[]>; hasPi: (id: string) => Promise<boolean>; hasRefund: (id: string) => Promise<boolean> };
const REAL: StripeSide = { intents: listPaymentIntents, refunds: listStripeRefunds, hasPi: paymentIntentExists, hasRefund: refundExists };
const thb = (satang: number) => Math.round(satang) / 100;

/** Compares one Thai day with Stripe, stores the result (one row per day, replaced when run again) and returns it. `stripe` can be replaced in tests. */
export async function reconcileDay(day: string, stripe: StripeSide = REAL): Promise<{ status: "ok" | "issues" | "error" | "skipped"; report?: Report; error?: string }> {
  const range = thaiDayRange(day); if (!range) return { status: "error", error: "bad day" };
  const save = (row: Record<string, unknown>) => db().from("reconciliation_reports").upsert({ day, run_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null, ...row }, { onConflict: "day" });
  if (stripe === REAL && !stripeConfigured()) { await save({ status: "skipped", error: "STRIPE_SECRET_KEY is not set" }); return { status: "skipped" }; }
  try {
    const slackFrom = new Date(range.from.getTime() - 86_400_000), slackTo = new Date(range.to.getTime() + 86_400_000), sec = (d: Date) => Math.floor(d.getTime() / 1000);
    const [rawIntents, rawRefunds] = await Promise.all([stripe.intents(sec(slackFrom), sec(slackTo)), stripe.refunds(sec(slackFrom), sec(slackTo))]);
    // The Stripe account may be shared with other apps: only what belongs to ThaiPass is compared. A payment is ours when its metadata.payment_id is one of OUR payment ids
    // (or its PaymentIntent id is already on one of our payments). Anything else in the account is none of our business.
    const metaIds = [...new Set(rawIntents.map((p) => p.metadata?.payment_id).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))];
    const [{ data: mine }, { data: allPi }] = await Promise.all([
      metaIds.length ? db().from("payments").select("id").in("id", metaIds) : Promise.resolve({ data: [] as { id: string }[] }),
      db().from("payments").select("provider_payment_ref").not("provider_payment_ref", "is", null).limit(50000),
    ]);
    const ourIds = new Set((mine ?? []).map((m) => m.id)), ourPis = new Set((allPi ?? []).map((m) => m.provider_payment_ref as string));
    const intents = rawIntents.filter((p) => p.currency === "thb" && p.status === "succeeded" && ((p.metadata?.payment_id && ourIds.has(p.metadata.payment_id)) || ourPis.has(p.id)));
    for (const p of intents) ourPis.add(p.id);
    const charges = intents.map((p) => { const lc = typeof p.latest_charge === "object" && p.latest_charge ? p.latest_charge : null; return { id: p.id, pi: p.id, amountThb: thb(p.amount_received), created: lc?.created ?? p.created, paid: true }; });
    const refunds = rawRefunds.filter((r) => r.currency === "thb" && r.payment_intent && ourPis.has(r.payment_intent)).map((r) => ({ id: r.id, pi: r.payment_intent, amountThb: thb(r.amount), created: r.created, status: r.status }));
    const piList = charges.map((c) => c.pi).filter((x): x is string => !!x);
    const cols = "id, provider_payment_ref, amount_thb, status, paid_at, receipt_no";
    const [byTime, byPi, { data: rf }] = await Promise.all([
      db().from("payments").select(cols).not("paid_at", "is", null).gte("paid_at", slackFrom.toISOString()).lt("paid_at", slackTo.toISOString()).limit(5000),
      piList.length ? db().from("payments").select(cols).in("provider_payment_ref", piList) : Promise.resolve({ data: [] as never[] }),
      db().from("refunds").select("id, provider_refund_id, amount_thb, status, created_at").gte("created_at", slackFrom.toISOString()).lt("created_at", slackTo.toISOString()).limit(5000),
    ]);
    const seen = new Set<string>(), ours = [...(byTime.data ?? []), ...((byPi as { data: typeof byTime.data }).data ?? [])].filter((p) => !seen.has(p.id) && !!seen.add(p.id))
      .map((p) => ({ id: p.id, pi: p.provider_payment_ref as string | null, amountThb: Number(p.amount_thb), status: p.status as string, paidAt: p.paid_at as string | null, receipt: p.receipt_no as string | null }));
    const ourRefunds = (rf ?? []).map((r) => ({ id: r.id, providerRefundId: r.provider_refund_id as string | null, amountThb: Number(r.amount_thb), status: r.status as string, createdAt: r.created_at as string }));
    // ours-only candidates are asked about directly before they are reported
    const known = new Set(piList), stripeHasPi = new Set<string>(), stripeHasRefund = new Set<string>(), knownRefunds = new Set(refunds.map((r) => r.id));
    for (const o of ours) if (isPaidStatus(o.status) && o.paidAt && Date.parse(o.paidAt) >= range.from.getTime() && Date.parse(o.paidAt) < range.to.getTime() && o.pi && !known.has(o.pi) && (await stripe.hasPi(o.pi))) stripeHasPi.add(o.pi);
    for (const r of ourRefunds) if (r.providerRefundId && !knownRefunds.has(r.providerRefundId) && (await stripe.hasRefund(r.providerRefundId))) stripeHasRefund.add(r.providerRefundId);
    const report = reconcile({ day, from: range.from, to: range.to, charges, refunds, ours, ourRefunds, stripeHasPi, stripeHasRefund });
    const status = report.issues.length ? "issues" : "ok";
    await save({ status, stripe_gross_thb: report.stripeGrossThb, ours_gross_thb: report.oursGrossThb, stripe_refunds_thb: report.stripeRefundsThb, ours_refunds_thb: report.oursRefundsThb, stripe_count: report.stripeCount, ours_count: report.oursCount, issues: report.issues, error: null });
    return { status, report };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200); console.error("[reconcile] failed", day, msg);
    await save({ status: "error", error: msg }); return { status: "error", error: msg };
  }
}

/** The daily job: yesterday (Thai time) once; staff are told when there are differences. A day that failed is tried again on the next run. */
export async function runDailyReconcile(): Promise<string> {
  const day = yesterdayThai();
  const { data: have } = await db().from("reconciliation_reports").select("status").eq("day", day).maybeSingle();
  if (have && have.status !== "error") return `done: ${have.status}`;
  const r = await reconcileDay(day);
  if (r.status === "issues" && r.report) {
    const { data: admins } = await db().from("admins").select("user_id");
    for (const a of admins ?? []) {
      const { data: p } = await db().from("profiles").select("lang").eq("id", a.user_id).maybeSingle(), t = DICTS[isLang(p?.lang) ? p.lang : "en"];
      await notifyUser({ userId: a.user_id, title: fmt(t.recon_notif_title, { n: String(r.report.issues.length), day }), body: t.recon_notif_body, link: `/admin/reconcile?date=${day}`, kind: "reconcile", dedupeKey: `recon:${day}` });
    }
  }
  return r.status;
}
