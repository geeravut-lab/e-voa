"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStatus } from "@/lib/immigration/pipeline";
import { runPreCheck } from "@/lib/applications/service";
import { refundAddon, refundException, refundUnusedAddons } from "@/lib/payments/service";
import { issueAddon } from "@/lib/partners/service";
import type { ActionResult } from "@/components/ActionForm";

// Every action here starts with requireAdminAction (rule 6). Staff never set "approved"/"rejected": those come from Immigration only (rule 8).
const uuid = z.string().uuid();
const done = (id: string): ActionResult => { revalidatePath(`/admin/queue/${id}`); revalidatePath("/admin/queue"); return { ok: true }; };

export async function addNoteAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("ops"); if (!a.ok) return a;
  const id = uuid.safeParse(fd.get("appId")), body = String(fd.get("body") ?? "").trim();
  if (!id.success || body.length < 1 || body.length > 1000) return { ok: false, error: "err_form_incomplete" };
  const ins = await createAdminClient().from("application_notes").insert({ application_id: id.data, author_id: a.viewer.user.id, body }).select("id");
  if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "ops.note", entity: "application", entityId: id.data });
  return done(id.data);
}

/** "Please fix this": the traveler gets the reason and can upload again. */
export async function requestFixAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("ops"); if (!a.ok) return a;
  const id = uuid.safeParse(fd.get("appId")), reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  if (!id.success || !reason) return { ok: false, error: "err_form_incomplete" };
  const { data, error } = await createAdminClient().rpc("transition_application", { p_id: id.data, p_to: "action_required", p_reason: reason, p_source: "ops", p_actor: a.viewer.user.id, p_only_from: ["pre_check", "submitted", "under_review"] });
  if (error || (data as { status?: string } | null)?.status !== "action_required") return { ok: false, error: "err_bad_transition" };
  const { data: app } = await createAdminClient().from("applications").select("id, ref_no, owner_id").eq("id", id.data).maybeSingle();
  if (app) await notifyStatus(app, "action_required", reason);
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "ops.request_fix", entity: "application", entityId: id.data });
  return done(id.data);
}

/** The send to Immigration failed for good: put it back in front of the checks and try again. */
export async function retrySendAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("ops"); if (!a.ok) return a;
  const id = uuid.safeParse(fd.get("appId")); if (!id.success) return { ok: false, error: "err_form_incomplete" };
  const { data, error } = await createAdminClient().rpc("transition_application", { p_id: id.data, p_to: "pre_check", p_reason: null, p_source: "ops", p_actor: a.viewer.user.id, p_only_from: ["submission_failed"] });
  if (error || (data as { status?: string } | null)?.status !== "pre_check") return { ok: false, error: "err_bad_transition" };
  await runPreCheck(id.data);
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "ops.retry_send", entity: "application", entityId: id.data });
  return done(id.data);
}

/** Cancels an application that has not been decided. Per policy the visa and service fees stay; unused add-ons go back. */
export async function cancelApplicationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("ops"); if (!a.ok) return a;
  const id = uuid.safeParse(fd.get("appId")), reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || "cancelled by staff";
  if (!id.success) return { ok: false, error: "err_form_incomplete" };
  const { data, error } = await createAdminClient().rpc("transition_application", { p_id: id.data, p_to: "cancelled", p_reason: reason, p_source: "ops", p_actor: a.viewer.user.id, p_only_from: ["draft", "awaiting_payment", "paid", "pre_check", "action_required", "submission_failed"] });
  if (error || (data as { status?: string } | null)?.status !== "cancelled") return { ok: false, error: "err_bad_transition" };
  await refundUnusedAddons(id.data, reason).catch(() => 0);
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "ops.cancel", entity: "application", entityId: id.data });
  return done(id.data);
}

export async function refundExceptionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance"); if (!a.ok) return a;
  const pid = uuid.safeParse(fd.get("paymentId")), appId = String(fd.get("appId") ?? ""), amount = Number(fd.get("amount")), reason = String(fd.get("reason") ?? "").trim();
  if (!pid.success || !Number.isFinite(amount) || amount <= 0 || reason.length < 3) return { ok: false, error: "err_form_incomplete" };
  const r = await refundException(pid.data, Math.round(amount * 100) / 100, reason, a.viewer.user.id);
  return r.ok ? done(appId) : { ok: false, error: r.error };
}

export async function refundAddonAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance"); if (!a.ok) return a;
  const oid = uuid.safeParse(fd.get("orderId")), appId = String(fd.get("appId") ?? "");
  if (!oid.success) return { ok: false, error: "err_form_incomplete" };
  const r = await refundAddon(oid.data, String(fd.get("reason") ?? "").trim() || "refunded by staff", a.viewer.user.id);
  return r.ok ? done(appId) : { ok: false, error: r.error };
}

export async function retryAddonAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("ops"); if (!a.ok) return a;
  const oid = uuid.safeParse(fd.get("orderId")), appId = String(fd.get("appId") ?? "");
  if (!oid.success) return { ok: false, error: "err_form_incomplete" };
  const back = await createAdminClient().from("addon_orders").update({ status: "paid", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null }).eq("id", oid.data).eq("status", "failed").select("id");
  if (back.data?.length !== 1) return { ok: false, error: "err_bad_transition" };
  await issueAddon(oid.data);
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "ops.addon_retry", entity: "addon_order", entityId: oid.data });
  return done(appId);
}
