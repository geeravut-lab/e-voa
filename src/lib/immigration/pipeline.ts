import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { saveDocument } from "@/lib/documents";
import { DICTS, fmt, type Dict } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import { statusFromImmigration, statusFromImmigrationText, type AppStatus } from "@/lib/applications/state";
import { ImmigrationError, type ImmigrationGateway } from "./gateway";
import { SimulatedGateway } from "./simulator";
import { buildDocket, DocketBuildError, loadDocketDocuments, type AppRow } from "./docket";
import type { StatusCallback } from "./schema";

const BACKOFF_MIN = [1, 5, 15, 60, 180];            // minutes before attempt 2, 3, 4, 5, 6
export const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;
export const backoffMinutes = (attemptsDone: number) => BACKOFF_MIN[Math.min(attemptsDone - 1, BACKOFF_MIN.length - 1)];

const APP_COLS = "id, ref_no, owner_id, trip_id, traveler_id, package, status, form, visa_fee_thb, service_fee_thb, batch_reference, payment_receipt_ref, immigration_ref";

async function transition(id: string, to: AppStatus, reason: string | null, source: "immigration" | "system" | "ops", actor: string | null = null, onlyFrom: AppStatus[] | null = null) {
  const { data, error } = await createAdminClient().rpc("transition_application", { p_id: id, p_to: to, p_reason: reason, p_source: source, p_actor: actor, p_only_from: onlyFrom });
  if (error) throw new Error(error.message);
  return data as { id: string; status: string };
}

async function langOf(userId: string): Promise<{ lang: Lang; t: Dict }> {
  const { data } = await createAdminClient().from("profiles").select("lang").eq("id", userId).maybeSingle();
  const lang: Lang = isLang(data?.lang) ? data.lang : "en";
  return { lang, t: DICTS[lang] };
}

/** One in-app notification per event, in the traveler's language. dedupeKey makes a repeated callback notify only once. */
export async function notifyStatus(app: Pick<AppRow, "id" | "ref_no" | "owner_id">, status: AppStatus, reason?: string | null) {
  const { t } = await langOf(app.owner_id);
  const v = { ref: app.ref_no, reason: reason ?? "" };
  const msg: Partial<Record<AppStatus, [string, string]>> = {
    submitted: [t.notif_submitted_title, fmt(t.notif_submitted_body, v)],
    approved: [t.notif_approved_title, fmt(t.notif_approved_body, v)],
    rejected: [t.notif_rejected_title, fmt(t.notif_rejected_body, v)],
    action_required: [t.notif_action_title, fmt(t.notif_action_body, v)],
    submission_failed: [t.notif_failed_title, fmt(t.notif_failed_body, v)],
  };
  const m = msg[status];
  if (!m) return;
  await notifyUser({ userId: app.owner_id, title: m[0], body: m[1], link: "/trips", kind: `application.${status}`, dedupeKey: `app:${app.id}:${status}` });
}

// ------------------------------------------------------------------ sending
export function enqueueDocket(applicationId: string) {
  return createAdminClient().from("immigration_outbox").insert({ application_id: applicationId, kind: "docket", idempotency_key: `docket:${applicationId}` }).select("id");
}

export type SendOutcome = "sent" | "refused" | "retry" | "skipped";

/** Sends one application. Never changes status to "submitted" unless Immigration accepted it. */
export async function sendApplication(gw: ImmigrationGateway, applicationId: string): Promise<{ outcome: SendOutcome; error?: string }> {
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select(APP_COLS).eq("id", applicationId).maybeSingle<AppRow>();
  if (!app) return { outcome: "skipped", error: "application not found" };
  if (app.status !== "pre_check" && app.status !== "submission_failed") return { outcome: "skipped", error: `status is ${app.status}` };
  if (app.immigration_ref) return { outcome: "skipped", error: "already has an Immigration reference" };

  let docket;
  try { docket = await buildDocket(app, gw instanceof SimulatedGateway); }
  catch (e) {
    if (e instanceof DocketBuildError) { await refuse(app, `We could not build the application: ${e.message}`); return { outcome: "refused", error: e.code }; }
    throw e;
  }
  const ours = docket.Applicants[0].applicantDetails.paymentReceiptRefNumber;
  // Record our batch id BEFORE sending: Immigration can answer (callback) faster than we save its reference, and the callback carries this id.
  if (app.batch_reference !== docket.batchReference) {
    const pre = await db.from("applications").update({ batch_reference: docket.batchReference }).eq("id", app.id).select("id");
    if (pre.data?.length !== 1) throw new Error("could not save the batch reference");
  }
  const res = await gw.submitDocket(docket);                                 // may throw ImmigrationError: the caller decides about retry
  const ok = res.successList.find((s) => s.paymentReceiptRefNumber === ours);
  if (!ok) {
    const reason = res.failedList.find((f) => f.paymentReceiptRefNumber === ours)?.Reason ?? res.errorDesc ?? "Immigration did not accept the application";
    await refuse(app, `Immigration: ${reason}`);
    return { outcome: "refused", error: reason };
  }
  // Save the reference FIRST so a very fast callback can find the application, then record the new status.
  const upd = await db.from("applications").update({ immigration_ref: ok.webReferenceNumber }).eq("id", app.id).select("id");
  if (upd.data?.length !== 1) throw new Error("could not save the Immigration reference");
  // Only if still waiting: a very fast callback may already have moved it further, and that decision must stay.
  const moved = await transition(app.id, "submitted", null, "system", null, ["pre_check", "submission_failed"]);
  if (moved.status === "submitted") await notifyStatus(app, "submitted");
  await audit({ actorId: null, actorRole: "system", action: "immigration.submit", entity: "application", entityId: app.id, detail: { ref: app.ref_no, web: ok.webReferenceNumber } });
  return { outcome: "sent" };
}

async function refuse(app: AppRow, reason: string) {
  await transition(app.id, "submission_failed", reason.slice(0, 500), "system");
  await notifyStatus(app, "submission_failed");
  await audit({ actorId: null, actorRole: "system", action: "immigration.refused", entity: "application", entityId: app.id, detail: { ref: app.ref_no } });
}

/** Works through the queue: claims due rows, sends, applies back-off. Returns a short summary for the cron log. */
export async function processOutbox(gw: ImmigrationGateway, limit = 10): Promise<{ sent: number; refused: number; retry: number; skipped: number }> {
  const db = createAdminClient();
  const sum = { sent: 0, refused: 0, retry: 0, skipped: 0 };
  const { data: due } = await db.from("immigration_outbox").select("id, application_id, attempts, kind").in("status", ["pending", "sending"]).lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(limit);
  for (const row of due ?? []) {
    if (row.kind !== "docket") continue;
    const attempts = row.attempts + 1;
    // Claim it (a row left in "sending" by a crashed run becomes due again after 10 minutes).
    const claim = await db.from("immigration_outbox").update({ status: "sending", attempts, next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString() }).eq("id", row.id).eq("attempts", row.attempts).select("id");
    if (claim.data?.length !== 1) continue;
    try {
      const r = await sendApplication(gw, row.application_id);
      await db.from("immigration_outbox").update({ status: r.outcome === "sent" ? "sent" : r.outcome === "refused" ? "failed" : "failed", sent_at: r.outcome === "sent" ? new Date().toISOString() : null, last_error: r.error ?? null }).eq("id", row.id);
      sum[r.outcome]++;
    } catch (e) {
      const err = e as Error;
      const retryable = (e instanceof ImmigrationError && e.retryable) || !(e instanceof ImmigrationError);
      if (retryable && attempts < MAX_ATTEMPTS) {
        await db.from("immigration_outbox").update({ status: "pending", last_error: err.message.slice(0, 300), next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString() }).eq("id", row.id);
        sum.retry++;
      } else {
        await db.from("immigration_outbox").update({ status: "failed", last_error: err.message.slice(0, 300) }).eq("id", row.id);
        const { data: app } = await db.from("applications").select(APP_COLS).eq("id", row.application_id).maybeSingle<AppRow>();
        if (app && (app.status === "pre_check" || app.status === "submission_failed")) await refuse(app, `Could not reach Immigration after ${attempts} attempts: ${err.message}`.slice(0, 300)).catch((x) => console.error("[pipeline] refuse failed", x.message));
        sum.refused++;
      }
    }
  }
  return sum;
}

// ------------------------------------------------------------------ results coming back
export type CallbackResult = { isSuccess: boolean; errorDesc?: string; retryLater?: boolean };

async function storeEvoa(app: Pick<AppRow, "id" | "owner_id">, bytes: Buffer) {
  const db = createAdminClient();
  const { count } = await db.from("documents").select("id", { count: "exact", head: true }).eq("application_id", app.id).eq("kind", "evoa").is("deleted_at", null);
  if ((count ?? 0) > 0) return;                                         // a repeated callback must not store a second copy
  const r = await saveDocument({ ownerId: app.owner_id, applicationId: app.id, kind: "evoa", bytes });
  if (!r.ok) throw new Error(`cannot store the E-VOA: ${r.error}`);
}

/** Applies a decision from Immigration (callback or polling). Idempotent: the same decision twice does nothing the second time. */
export async function applyDecision(app: AppRow, target: AppStatus, reason: string | null, evoa: Buffer | null): Promise<CallbackResult> {
  if (app.status === "pre_check" || app.status === "submission_failed") await transition(app.id, "submitted", "Confirmed by Immigration", "immigration", null, ["pre_check", "submission_failed"]);   // the answer outran our own bookkeeping
  if (target === "approved" && evoa) await storeEvoa(app, evoa);
  if (target === "approved" && !evoa) return { isSuccess: false, errorDesc: "approval without document content; send evoaContent or let us download it" };
  try {
    const row = await transition(app.id, target, reason, "immigration");
    if (row.status === target) await notifyStatus(app, target, reason);
    // Rejected: the visa and service fees stay (policy), but add-ons that were never used go back to the traveler. A failure here must not undo the decision.
    if (target === "rejected" && row.status === target) {
      const { refundUnusedAddons } = await import("@/lib/payments/service");
      await refundUnusedAddons(app.id, "application rejected").catch((e) => console.error("[pipeline] add-on refund failed", (e as Error).message));
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (/err_bad_transition/.test(msg)) {
      await audit({ actorId: null, actorRole: "immigration", action: "immigration.callback.refused", entity: "application", entityId: app.id, detail: { target, from: app.status } });
      return { isSuccess: false, errorDesc: `status ${app.status} cannot change to ${target}` };
    }
    throw e;
  }
  await audit({ actorId: null, actorRole: "immigration", action: "immigration.decision", entity: "application", entityId: app.id, detail: { ref: app.ref_no, status: target } });
  return { isSuccess: true };
}

export async function handleStatusCallback(cb: StatusCallback, gw: ImmigrationGateway | null): Promise<CallbackResult> {
  const db = createAdminClient();
  const target = statusFromImmigration(cb.statusId);
  if (!target) return { isSuccess: false, errorDesc: `unknown statusId ${cb.statusId}` };
  let { data: app } = await db.from("applications").select(APP_COLS).eq("immigration_ref", cb.webReferenceNumber).maybeSingle<AppRow>();
  if (!app) {
    // The answer can outrun our own bookkeeping: the reference is not saved yet, but the batch id was saved before sending.
    const { data: waiting } = await db.from("applications").select(APP_COLS).eq("batch_reference", cb.batchReference).is("immigration_ref", null).in("status", ["pre_check", "submission_failed", "submitted"]).limit(2);
    if (!waiting || waiting.length === 0) return { isSuccess: false, errorDesc: "unknown webReferenceNumber" };
    if (waiting.length > 1) return { isSuccess: false, errorDesc: "several applications are waiting in this batch; try again shortly", retryLater: true };
    const adopt = await db.from("applications").update({ immigration_ref: cb.webReferenceNumber }).eq("id", waiting[0].id).is("immigration_ref", null).select("id");
    if (adopt.data?.length !== 1) return { isSuccess: false, errorDesc: "try again shortly", retryLater: true };   // someone else saved it a moment ago
    app = { ...(waiting[0] as AppRow), immigration_ref: cb.webReferenceNumber };
  }
  if (app.batch_reference && app.batch_reference !== cb.batchReference) return { isSuccess: false, errorDesc: "batchReference does not match" };
  let evoa: Buffer | null = cb.evoaContent ? Buffer.from(cb.evoaContent, "base64") : null;
  if (target === "approved" && !evoa && gw && app.payment_receipt_ref) evoa = await gw.evoa(app.immigration_ref!, app.payment_receipt_ref).catch(() => null);
  return applyDecision(app, target, cb.statusDesc ?? null, evoa);
}

/** Fallback when a callback never arrived: ask Immigration about applications that have waited a while. */
export async function pollPending(gw: ImmigrationGateway, olderThanMinutes = 15, limit = 20): Promise<{ checked: number; changed: number }> {
  const db = createAdminClient();
  const before = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data } = await db.from("applications").select(APP_COLS).in("status", ["submitted", "under_review"]).not("immigration_ref", "is", null).lt("updated_at", before).order("updated_at").limit(limit);
  let changed = 0;
  for (const app of (data ?? []) as AppRow[]) {
    try {
      const text = await gw.status(app.immigration_ref!, app.payment_receipt_ref ?? "");
      const target = text ? statusFromImmigrationText(text) : null;
      if (!target || target === app.status) { if (target === app.status) await db.from("applications").update({ updated_at: new Date().toISOString() }).eq("id", app.id); continue; }
      if (target === "under_review") { await transition(app.id, "under_review", null, "immigration", null, ["submitted"]); changed++; continue; }
      const evoa = target === "approved" ? await gw.evoa(app.immigration_ref!, app.payment_receipt_ref ?? "") : null;
      const r = await applyDecision(app, target, null, evoa);
      if (r.isSuccess) changed++;
    } catch (e) { console.error("[pipeline] poll failed for", app.ref_no, (e as Error).message); }
  }
  return { checked: data?.length ?? 0, changed };
}

/** Traveler fixed what Immigration asked for: send the extra documents and move back to review. */
export async function sendAdditionalDocuments(gw: ImmigrationGateway, applicationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select(APP_COLS).eq("id", applicationId).maybeSingle<AppRow>();
  if (!app || app.status !== "action_required" || !app.immigration_ref || !app.payment_receipt_ref || !app.batch_reference) return { ok: false, error: "err_bad_transition" };
  const docs = await loadDocketDocuments(app.id, ["additional"]);
  try { await gw.uploadAdditionalDocuments({ batchReference: app.batch_reference, paymentReceiptNumber: app.payment_receipt_ref, webReferenceNumber: app.immigration_ref, documentList: docs.slice(0, 5) }); }
  catch (e) { return { ok: false, error: e instanceof ImmigrationError && e.kind === "auth" ? "err_immigration_auth" : "err_immigration_down" }; }
  await transition(app.id, "under_review", "Additional documents sent", "system");
  return { ok: true };
}
