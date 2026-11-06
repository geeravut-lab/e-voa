import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { SITE_URL } from "@/lib/env";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { buildLineItems, toSatang, totalThb, type LineItem, type PackageKind } from "@/lib/pricing";
import { ApplicationForm } from "@/lib/immigration/form";
import { evaluatePreCheck } from "@/lib/applications/precheck";
import { documentKinds, requiredDocuments, runPreCheck } from "@/lib/applications/service";
import { DEFAULT_REFUND_POLICY, capRefund, parseRefundPolicy, refundableForAddon, type AddonState } from "./refund-policy";
import { createCheckoutSession, createRefund, expireSession, paymentIntentId, retrieveSession, StripeError } from "./stripe";

const admin = () => createAdminClient();
const transition = (id: string, to: string, from: string[] | null, reason: string | null = null, source = "payment", actor: string | null = null) =>
  admin().rpc("transition_application", { p_id: id, p_to: to, p_reason: reason, p_source: source, p_actor: actor, p_only_from: from });

const langOf = async (userId: string): Promise<Lang> => { const { data } = await admin().from("profiles").select("lang").eq("id", userId).maybeSingle(); return isLang(data?.lang) ? data.lang : "en"; };

export type CheckoutResult = { ok: true; url: string; paymentId: string } | { ok: false; error: string; details?: { applicationId: string; problems: string[] }[] };

/**
 * Turns a trip's draft applications (and the add-ons picked for them) into ONE payment and one Stripe Checkout page.
 * Nothing is charged here; the money is confirmed later by confirmPayment (webhook or the return page), both of which ask Stripe again.
 */
export async function startCheckout(userId: string, email: string | null, tripId: string, lang: Lang = "en"): Promise<CheckoutResult> {
  const db = admin();
  const { data: apps } = await db.from("applications").select("id, ref_no, status, package, visa_fee_thb, service_fee_thb, traveler_id, form, payment_id").eq("trip_id", tripId).eq("owner_id", userId).in("status", ["draft", "awaiting_payment"]);
  if (!apps || apps.length === 0) return { ok: false, error: "err_nothing_to_pay" };
  const { data: trip } = await db.from("trips").select("arrival_date, departure_date").eq("id", tripId).eq("owner_id", userId).maybeSingle();
  if (!trip) return { ok: false, error: "err_not_found" };

  // Complete before you pay: the form and the documents must be there (insurance may still be on its way from the add-on).
  const required = await requiredDocuments(); const bad: { applicationId: string; problems: string[] }[] = [];
  const addonRows = (await db.from("addon_orders").select("id, application_id, category, package_name, price_thb").in("application_id", apps.map((a) => a.id)).eq("status", "pending_payment")).data ?? [];
  const names = new Map<string, string>();
  for (const a of apps) {
    const { data: tr } = await db.from("travelers").select("given_name, surname, passport_expiry_date, date_of_birth").eq("id", a.traveler_id).maybeSingle();
    names.set(a.id, tr ? `${tr.given_name} ${tr.surname}` : a.ref_no);
    const problems: string[] = [];
    if (!ApplicationForm.safeParse(a.form).success) problems.push("form_incomplete");
    const pre = evaluatePreCheck({ now: new Date(), arrivalDate: trip.arrival_date, departureDate: trip.departure_date, passportExpiry: tr?.passport_expiry_date ?? null, dateOfBirth: tr?.date_of_birth ?? null, documentKinds: await documentKinds(a.id), requiredKinds: required, insurancePending: addonRows.some((x) => x.application_id === a.id && x.category === "insurance") });
    for (const p of pre.problems) problems.push(p.kind ? `${p.code}:${p.kind}` : p.code);
    if (problems.length) bad.push({ applicationId: a.id, problems });
  }
  if (bad.length) return { ok: false, error: "err_incomplete", details: bad };

  // An earlier unpaid checkout for these applications is cancelled first, so the new total is always right.
  for (const pid of new Set(apps.map((a) => a.payment_id).filter((x): x is string => !!x))) await failPayment(pid, "replaced by a new checkout");
  const { data: fresh } = await db.from("applications").select("id").in("id", apps.map((a) => a.id)).in("status", ["draft", "awaiting_payment"]);
  if ((fresh?.length ?? 0) !== apps.length) return { ok: false, error: "err_generic" };

  const items: LineItem[] = buildLineItems(
    apps.map((a) => ({ id: a.id, package: a.package as PackageKind, travelerName: names.get(a.id) ?? a.ref_no, visaFeeThb: a.visa_fee_thb, serviceFeeThb: a.service_fee_thb })),
    addonRows.map((x) => ({ id: x.id, applicationId: x.application_id, name: x.package_name, priceThb: Number(x.price_thb) })),
  );
  let total: number; try { total = totalThb(items); } catch { return { ok: false, error: "err_generic" }; }
  if (total <= 0) return { ok: false, error: "err_nothing_to_pay" };

  const pay = await db.from("payments").insert({ owner_id: userId, amount_thb: total, provider: "stripe", trip_id: tripId, items, expires_at: new Date(Date.now() + 60 * 60_000).toISOString() }).select("id").single();
  if (pay.error || !pay.data) return { ok: false, error: "err_generic" };
  const paymentId = pay.data.id as string;
  const link = await Promise.all(apps.map((a) => db.from("applications").update({ payment_id: paymentId, payment_receipt_ref: `PR-${a.ref_no}-${paymentId.slice(0, 6)}` }).eq("id", a.id).select("id")));
  if (link.some((r) => r.data?.length !== 1)) { await failPayment(paymentId, "could not attach applications"); return { ok: false, error: "err_generic" }; }
  if (addonRows.length) await db.from("addon_orders").update({ payment_id: paymentId }).in("id", addonRows.map((x) => x.id));
  for (const a of apps) if (a.status === "draft") { const { error } = await transition(a.id, "awaiting_payment", ["draft"], null, "user", userId); if (error) { await failPayment(paymentId, error.message); return { ok: false, error: "err_generic" }; } }

  try {
    const s = await createCheckoutSession({
      paymentId, items: items.map((i) => ({ label: i.label, amountSatang: toSatang(i.amountThb) })), email,
      successUrl: `${SITE_URL}/pay/return?payment=${paymentId}&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${SITE_URL}/pay/return?payment=${paymentId}&cancelled=1`,
      locale: lang === "zh-CN" ? "zh" : lang === "th" ? "th" : "en",
    });
    const upd = await db.from("payments").update({ provider_ref: s.id }).eq("id", paymentId).select("id");
    if (upd.data?.length !== 1 || !s.url) throw new Error("could not save the session");
    await audit({ actorId: userId, action: "payment.start", entity: "payment", entityId: paymentId, detail: { total_thb: total, items: items.length } });
    return { ok: true, url: s.url, paymentId };
  } catch (e) {
    await failPayment(paymentId, `checkout failed: ${(e as Error).message}`);
    return { ok: false, error: e instanceof StripeError && e.code === "not_configured" ? "err_not_configured" : "err_payment_provider" };
  }
}

/** Unpaid order cancelled or expired: the payment is closed and its applications return to draft so the traveler can pay again. */
export async function failPayment(paymentId: string, why: string): Promise<void> {
  const db = admin();
  const { data: p } = await db.from("payments").update({ status: "failed" }).eq("id", paymentId).eq("status", "pending").select("id, provider_ref");
  if (!p || p.length === 0) return;                                    // already paid or already closed: leave it
  if (p[0].provider_ref) await expireSession(p[0].provider_ref).catch(() => undefined);
  const { data: apps } = await db.from("applications").select("id").eq("payment_id", paymentId);
  for (const a of apps ?? []) await transition(a.id, "draft", ["awaiting_payment"], null, "payment");
  await db.from("addon_orders").update({ payment_id: null }).eq("payment_id", paymentId).eq("status", "pending_payment");
  await audit({ actorId: null, actorRole: "system", action: "payment.failed", entity: "payment", entityId: paymentId, detail: { why: why.slice(0, 70) } });
}

export type ConfirmResult = { ok: true; status: "paid" | "already_paid" } | { ok: false; error: "pending" | "not_found" | "mismatch" | "failed" | "stripe" };

/** Asks STRIPE (never the browser or the webhook body) whether this session was paid, checks the amount, then marks the payment paid exactly once. */
export async function confirmPayment(paymentId: string, sessionId?: string): Promise<ConfirmResult> {
  const db = admin();
  const { data: pay } = await db.from("payments").select("id, owner_id, status, amount_thb, provider_ref, trip_id").eq("id", paymentId).maybeSingle();
  if (!pay) return { ok: false, error: "not_found" };
  if (pay.status === "paid" || pay.status === "partially_refunded" || pay.status === "refunded") { await afterPayment(paymentId); return { ok: true, status: "already_paid" }; }
  if (pay.status === "failed") return { ok: false, error: "failed" };
  const sid = pay.provider_ref;
  if (!sid || (sessionId && sessionId !== sid)) return { ok: false, error: "mismatch" };
  let s; try { s = await retrieveSession(sid); } catch (e) { console.error("[payments] Stripe lookup failed", (e as Error).message); return { ok: false, error: "stripe" }; }
  if (s.metadata?.payment_id !== paymentId) return { ok: false, error: "mismatch" };
  if (s.payment_status !== "paid") return { ok: false, error: s.status === "expired" ? "failed" : "pending" };
  if (s.currency !== "thb" || s.amount_total !== toSatang(Number(pay.amount_thb))) {
    await audit({ actorId: null, actorRole: "system", action: "payment.amount_mismatch", entity: "payment", entityId: paymentId, detail: { expected: toSatang(Number(pay.amount_thb)), got: s.amount_total ?? 0 } });
    return { ok: false, error: "mismatch" };
  }
  const { data: row, error } = await db.rpc("mark_payment_paid", { p_id: paymentId, p_intent: paymentIntentId(s) });
  if (error) { console.error("[payments] mark paid failed", error.message); return { ok: false, error: "stripe" }; }
  if (!row || !(row as { id?: string }).id) { await afterPayment(paymentId); return { ok: true, status: "already_paid" }; }   // somebody else got there first
  await audit({ actorId: null, actorRole: "system", action: "payment.paid", entity: "payment", entityId: paymentId, detail: { amount_thb: Number(pay.amount_thb) } });
  await afterPayment(paymentId);
  return { ok: true, status: "paid" };
}

/** Everything that follows a payment. Every step is safe to repeat, so a crash in the middle is repaired by running it again (see reconcilePaid). */
export async function afterPayment(paymentId: string): Promise<void> {
  const db = admin();
  const { data: pay } = await db.from("payments").select("id, owner_id, amount_thb, receipt_no").eq("id", paymentId).maybeSingle();
  if (!pay) return;
  const { data: apps } = await db.from("applications").select("id, status").eq("payment_id", paymentId);
  for (const a of apps ?? []) {
    await transition(a.id, "paid", ["awaiting_payment"]);
    await transition(a.id, "pre_check", ["paid"]);
  }
  await db.from("addon_orders").update({ status: "paid" }).eq("payment_id", paymentId).eq("status", "pending_payment");
  const t = DICTS[await langOf(pay.owner_id)];
  await notifyUser({ userId: pay.owner_id, title: t.notif_paid_title, body: fmt(t.notif_paid_body, { amount: Number(pay.amount_thb).toLocaleString("en-US"), receipt: pay.receipt_no ?? "" }), link: `/receipts/${paymentId}`, kind: "payment.paid", dedupeKey: `pay:${paymentId}:paid` });
  const { issueAddon } = await import("@/lib/partners/service");
  const { data: addons } = await db.from("addon_orders").select("id").eq("payment_id", paymentId).eq("status", "paid");
  for (const x of addons ?? []) await issueAddon(x.id).catch((e) => console.error("[payments] add-on issue failed", (e as Error).message));
  for (const a of apps ?? []) await runPreCheck(a.id).catch((e) => console.error("[payments] pre-check failed", (e as Error).message));
}

/** Safety net for the tick: paid payments whose applications are still "awaiting_payment" (a crash between the two steps) are finished now. */
export async function reconcilePaid(limit = 20): Promise<number> {
  const db = admin();
  const { data } = await db.from("applications").select("payment_id").eq("status", "awaiting_payment").not("payment_id", "is", null).limit(limit);
  let n = 0;
  for (const pid of new Set((data ?? []).map((a) => a.payment_id as string))) {
    const { data: p } = await db.from("payments").select("status").eq("id", pid).maybeSingle();
    if (p && ["paid", "partially_refunded"].includes(p.status)) { await afterPayment(pid); n++; }
    else if (p?.status === "pending") { const r = await confirmPayment(pid).catch(() => null); if (r?.ok) n++; }        // paid at Stripe but we never heard about it
  }
  return n;
}

/** Unpaid for too long: close it and let the traveler start again. */
export async function expireUnpaid(limit = 50): Promise<number> {
  const { data } = await admin().from("payments").select("id").eq("status", "pending").lt("expires_at", new Date(Date.now() - 10 * 60_000).toISOString()).limit(limit);
  let n = 0;
  for (const p of data ?? []) { const r = await confirmPayment(p.id).catch(() => null); if (!r?.ok) { await failPayment(p.id, "expired unpaid"); n++; } }
  return n;
}

// ------------------------------------------------------------------ refunds (policy: only unused add-ons, decision Q4)
export type RefundResult = { ok: true; amountThb: number; refundId: string } | { ok: false; error: string };

async function doRefund(a: { paymentId: string; amountThb: number; kind: "addon" | "exception"; reason: string; addonOrderId?: string; actor: string | null }): Promise<RefundResult> {
  const db = admin();
  const { data: pay } = await db.from("payments").select("id, amount_thb, refunded_thb, provider_payment_ref, status").eq("id", a.paymentId).maybeSingle();
  if (!pay || !["paid", "partially_refunded"].includes(pay.status)) return { ok: false, error: "err_not_found" };
  const amount = capRefund(a.amountThb, Number(pay.amount_thb), Number(pay.refunded_thb));
  if (amount <= 0) return { ok: false, error: "err_nothing_to_refund" };
  if (!pay.provider_payment_ref) return { ok: false, error: "err_generic" };
  // Reserve the amount first (only succeeds while enough is left), then ask Stripe.
  const reserve = await db.from("payments").update({ refunded_thb: Number(pay.refunded_thb) + amount }).eq("id", pay.id).eq("refunded_thb", pay.refunded_thb).select("id");
  if (reserve.data?.length !== 1) return { ok: false, error: "err_conflict" };
  const rec = await db.from("refunds").insert({ payment_id: pay.id, addon_order_id: a.addonOrderId ?? null, amount_thb: amount, kind: a.kind, reason: a.reason.slice(0, 200), actor_id: a.actor }).select("id").single();
  const undo = () => db.from("payments").update({ refunded_thb: Number(pay.refunded_thb) }).eq("id", pay.id);
  if (rec.error || !rec.data) { await undo(); return { ok: false, error: "err_generic" }; }
  try {
    const r = await createRefund({ paymentIntent: pay.provider_payment_ref, amountSatang: toSatang(amount), reason: a.reason, idempotencyKey: `refund:${rec.data.id}` });
    if (r.status === "failed" || r.status === "canceled") throw new Error(`Stripe refund ${r.status}`);
    await db.from("refunds").update({ status: "succeeded", provider_refund_id: r.id }).eq("id", rec.data.id);
    const total = Number(pay.refunded_thb) + amount;
    await db.from("payments").update({ status: total >= Number(pay.amount_thb) ? "refunded" : "partially_refunded" }).eq("id", pay.id);
    await audit({ actorId: a.actor, actorRole: a.actor ? "admin" : "system", action: "payment.refund", entity: "payment", entityId: pay.id, detail: { amount_thb: amount, kind: a.kind } });
    return { ok: true, amountThb: amount, refundId: rec.data.id };
  } catch (e) {
    await db.from("refunds").update({ status: "failed" }).eq("id", rec.data.id); await undo();
    console.error("[payments] refund failed", (e as Error).message);
    return { ok: false, error: "err_payment_provider" };
  }
}

/** Gives back an add-on that was not used. The amount comes from the refund policy, never from the caller. */
export async function refundAddon(addonOrderId: string, reason: string, actor: string | null): Promise<RefundResult> {
  const db = admin();
  const { data: o } = await db.from("addon_orders").select("id, owner_id, payment_id, price_thb, refunded_thb, status, package_name").eq("id", addonOrderId).maybeSingle();
  if (!o || !o.payment_id) return { ok: false, error: "err_not_found" };
  const policy = parseRefundPolicy(await getSetting<unknown>("refund_policy", DEFAULT_REFUND_POLICY));
  const state: AddonState = { id: o.id, priceThb: Number(o.price_thb), refundedThb: Number(o.refunded_thb), status: o.status };
  const amount = refundableForAddon(state, policy);
  if (amount <= 0) return { ok: false, error: "err_nothing_to_refund" };
  const claim = await db.from("addon_orders").update({ refunded_thb: Number(o.refunded_thb) + amount, status: "refunded" }).eq("id", o.id).eq("refunded_thb", o.refunded_thb).in("status", ["paid", "issuing", "issued", "failed"]).select("id");
  if (claim.data?.length !== 1) return { ok: false, error: "err_conflict" };
  const r = await doRefund({ paymentId: o.payment_id, amountThb: amount, kind: "addon", reason, addonOrderId: o.id, actor });
  if (!r.ok) { await db.from("addon_orders").update({ refunded_thb: Number(o.refunded_thb), status: o.status }).eq("id", o.id); return r; }
  const t = DICTS[await langOf(o.owner_id)];
  await notifyUser({ userId: o.owner_id, title: t.notif_refund_title, body: fmt(t.notif_refund_body, { amount: r.amountThb.toLocaleString("en-US"), item: o.package_name }), link: `/receipts/${o.payment_id}`, kind: "payment.refund", dedupeKey: `refund:${r.refundId}` });
  return r;
}

/** After a rejection: unused add-ons of that application are returned automatically (visa and service fees are not, per policy). */
export async function refundUnusedAddons(applicationId: string, reason: string): Promise<number> {
  const { data } = await admin().from("addon_orders").select("id").eq("application_id", applicationId).in("status", ["paid", "issuing", "issued", "failed"]);
  let sum = 0;
  for (const x of data ?? []) { const r = await refundAddon(x.id, reason, null); if (r.ok) sum += r.amountThb; }
  return sum;
}

/** Staff decision outside the policy (goodwill): any amount up to what is left on the payment. Always audited with the staff member's id. */
export const refundException = (paymentId: string, amountThb: number, reason: string, actor: string) => doRefund({ paymentId, amountThb, kind: "exception", reason, actor });
