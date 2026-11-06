import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { encryptText, hashId, last4 } from "@/lib/crypto";
import { saveDocument, type DocKind } from "@/lib/documents";
import { normalizeUpload } from "@/lib/images";
import { analyzePhoto } from "@/lib/photo-check";
import { applicationFees, parseFees, type PackageKind } from "@/lib/pricing";
import { DEFAULT_FEES } from "@/config/defaults";
import { ApplicationForm } from "@/lib/immigration/form";
import { enqueueDocket, notifyStatus } from "@/lib/immigration/pipeline";
import { evaluatePreCheck, encodeProblems, type PreCheckResult } from "./precheck";
import { travelerCanEdit, type AppStatus } from "./state";

/** Immigration's document ids (master list "documentList"): passport cover 1, photo 2, return ticket 3, accommodation 4, funds 5, insurance 6, additional 7. */
export const DOC_LIST_ID: Record<string, number> = { passport_bio: 1, photo: 2, return_ticket: 3, accommodation: 4, funds: 5, insurance: 6, additional: 7, other: 8 };
export const UPLOAD_KINDS = ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance", "additional"] as const;
export const DEFAULT_REQUIRED_DOCS = ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"];

export const requiredDocuments = async () => {
  const v = await getSetting<unknown>("required_documents", DEFAULT_REQUIRED_DOCS);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : DEFAULT_REQUIRED_DOCS;
};
export const loadFees = async () => parseFees(await getSetting<unknown>("fees", DEFAULT_FEES), DEFAULT_FEES);

export type TravelerInput = {
  id?: string; relation?: "self" | "family" | "friend" | "client"; given_name: string; middle_name?: string | null; surname: string; gender_id: number; salutation_id: number;
  date_of_birth: string; nationality_id: number; passport_no: string; passport_issue_date: string; passport_expiry_date: string; passport_place_of_issue: string; email?: string | null; phone?: string | null;
};

/** Saves a traveler; the passport number is stored encrypted + keyed hash. The same passport for the same owner updates the existing row. */
export async function upsertTraveler(ownerId: string, t: TravelerInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  const row = {
    owner_id: ownerId, relation: t.relation ?? "self", given_name: t.given_name.trim(), middle_name: t.middle_name?.trim() || null, surname: t.surname.trim(), gender_id: t.gender_id, salutation_id: t.salutation_id,
    date_of_birth: t.date_of_birth, nationality_id: t.nationality_id, passport_no_enc: encryptText(t.passport_no.trim()), passport_no_hash: hashId(t.passport_no), passport_last4: last4(t.passport_no),
    passport_issue_date: t.passport_issue_date, passport_expiry_date: t.passport_expiry_date, passport_place_of_issue: t.passport_place_of_issue.trim(), email: t.email?.trim() || null, phone: t.phone?.trim() || null,
  };
  const { data: existing } = await db.from("travelers").select("id").eq("owner_id", ownerId).eq("passport_no_hash", row.passport_no_hash).maybeSingle();
  const id = t.id ?? existing?.id;
  if (id) {
    const upd = await db.from("travelers").update(row).eq("id", id).eq("owner_id", ownerId).select("id");
    return upd.data?.length === 1 ? { ok: true, id } : { ok: false, error: "err_not_found" };
  }
  const ins = await db.from("travelers").insert(row).select("id").single();
  return ins.error || !ins.data ? { ok: false, error: "err_generic" } : { ok: true, id: ins.data.id };
}

const TERMINAL: AppStatus[] = ["expired", "rejected", "cancelled", "used", "no_show"];

/** One application per traveler per trip while it is alive. Price is frozen from the current settings. */
export async function createDraftApplication(ownerId: string, a: { tripId: string; travelerId: string; pkg: PackageKind; form: unknown }): Promise<{ ok: true; id: string } | { ok: false; error: string; fields?: string[] }> {
  const form = ApplicationForm.safeParse(a.form);
  if (!form.success) return { ok: false, error: "err_form_incomplete", fields: form.error.issues.map((i) => i.path.join(".")) };
  const db = createAdminClient();
  const { data: trip } = await db.from("trips").select("id").eq("id", a.tripId).eq("owner_id", ownerId).maybeSingle();
  const { data: tr } = await db.from("travelers").select("id").eq("id", a.travelerId).eq("owner_id", ownerId).maybeSingle();
  if (!trip || !tr) return { ok: false, error: "err_not_found" };
  const fees = applicationFees(await loadFees(), a.pkg);
  const { data: existing } = await db.from("applications").select("id, status").eq("trip_id", a.tripId).eq("traveler_id", a.travelerId).not("status", "in", `(${TERMINAL.join(",")})`).maybeSingle();
  if (existing) {
    if (!travelerCanEdit(existing.status as AppStatus)) return { ok: false, error: "err_locked" };
    const upd = await db.from("applications").update({ form: form.data, package: a.pkg, visa_fee_thb: fees.visa, service_fee_thb: fees.service }).eq("id", existing.id).select("id");
    return upd.data?.length === 1 ? { ok: true, id: existing.id } : { ok: false, error: "err_generic" };
  }
  const ins = await db.from("applications").insert({ owner_id: ownerId, trip_id: a.tripId, traveler_id: a.travelerId, package: a.pkg, form: form.data, visa_fee_thb: fees.visa, service_fee_thb: fees.service }).select("id").single();
  return ins.error || !ins.data ? { ok: false, error: "err_generic" } : { ok: true, id: ins.data.id };
}

/** Stores an uploaded file for an application: shrunk to Immigration's limits, encrypted, replacing the previous file of the same kind. */
export async function saveApplicationDocument(ownerId: string, applicationId: string, kind: string, bytes: Uint8Array): Promise<{ ok: true; id: string; warnings?: string[] } | { ok: false; error: string }> {
  if (!(UPLOAD_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "err_generic" };
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, status, owner_id").eq("id", applicationId).eq("owner_id", ownerId).maybeSingle();
  if (!app) return { ok: false, error: "err_not_found" };
  if (!travelerCanEdit(app.status as AppStatus)) return { ok: false, error: "err_locked" };
  const check = kind === "photo" ? await analyzePhoto(bytes) : null;          // advice about light, sharpness, size: shown to the traveler, never blocks
  const norm = await normalizeUpload(bytes, kind);
  if (!norm.ok) return norm;
  const saved = await saveDocument({ ownerId, applicationId, kind: kind as DocKind, docListId: DOC_LIST_ID[kind], bytes: norm.bytes });
  if (!saved.ok) return saved;
  if (kind !== "additional") {   // replace: the older file of this kind goes away (additional documents may be several)
    const { data: old } = await db.from("documents").select("id, storage_path").eq("application_id", applicationId).eq("kind", kind).is("deleted_at", null).neq("id", saved.id);
    for (const o of old ?? []) {
      await db.storage.from("documents").remove([o.storage_path]);
      await db.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", o.id).select("id");
    }
  }
  return check && check.warnings.length ? { ...saved, warnings: check.warnings } : saved;
}

export async function documentKinds(applicationId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("documents").select("kind").eq("application_id", applicationId).is("deleted_at", null);
  return [...new Set((data ?? []).map((d) => d.kind as string))];
}

/** Checks one application that is in pre_check. Complete → queued for Immigration; waiting for the insurance document → left alone; problems → action_required with reasons. */
export async function runPreCheck(applicationId: string, now = new Date()): Promise<"queued" | "waiting" | "action_required" | "skipped"> {
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, ref_no, owner_id, trip_id, traveler_id, status").eq("id", applicationId).maybeSingle();
  if (!app || app.status !== "pre_check") return "skipped";
  const [{ data: trip }, { data: tr }, kinds, required, { count: pendingIns }] = await Promise.all([
    db.from("trips").select("arrival_date, departure_date").eq("id", app.trip_id).maybeSingle(),
    db.from("travelers").select("passport_expiry_date, date_of_birth").eq("id", app.traveler_id).maybeSingle(),
    documentKinds(app.id), requiredDocuments(),
    db.from("addon_orders").select("id", { count: "exact", head: true }).eq("application_id", app.id).eq("category", "insurance").in("status", ["paid", "issuing"]),
  ]);
  if (!trip || !tr) return "skipped";
  const res: PreCheckResult = evaluatePreCheck({ now, arrivalDate: trip.arrival_date, departureDate: trip.departure_date, passportExpiry: tr.passport_expiry_date, dateOfBirth: tr.date_of_birth, documentKinds: kinds, requiredKinds: required, insurancePending: (pendingIns ?? 0) > 0 });
  if (res.ok) { await enqueueDocket(app.id); return "queued"; }
  if (res.waiting) return "waiting";
  const reason = encodeProblems(res.problems);
  const { error } = await db.rpc("transition_application", { p_id: app.id, p_to: "action_required", p_reason: reason, p_source: "system", p_actor: null, p_only_from: ["pre_check"] });
  if (error) throw new Error(error.message);
  await notifyStatus(app as { id: string; ref_no: string; owner_id: string }, "action_required", reason);
  await audit({ actorId: null, actorRole: "system", action: "precheck.failed", entity: "application", entityId: app.id, detail: { problems: res.problems.length } });
  return "action_required";
}

/** The traveler fixed what was missing: move back to pre_check and run the checks again. */
export async function resubmitAfterFix(ownerId: string, applicationId: string): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, status").eq("id", applicationId).eq("owner_id", ownerId).maybeSingle();
  if (!app) return { ok: false, error: "err_not_found" };
  if (app.status !== "action_required") return { ok: false, error: "err_bad_transition" };
  const { data: row, error } = await db.rpc("transition_application", { p_id: app.id, p_to: "pre_check", p_reason: null, p_source: "user", p_actor: ownerId, p_only_from: ["action_required"] });
  if (error) return { ok: false, error: "err_generic" };
  if ((row as { status: string }).status !== "pre_check") return { ok: false, error: "err_bad_transition" };
  return { ok: true, result: await runPreCheck(app.id) };
}

/**
 * The traveler cancels an application that has not been decided. Per policy the visa fee and the service fee stay; add-ons that were not used are refunded.
 * Allowed while nothing has been decided and nothing is waiting for payment (an unpaid order is edited from the payment page instead).
 */
export async function cancelByTraveler(ownerId: string, applicationId: string): Promise<{ ok: true; refundedThb: number } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, ref_no, status").eq("id", applicationId).eq("owner_id", ownerId).maybeSingle();
  if (!app) return { ok: false, error: "err_not_found" };
  const { data: row, error } = await db.rpc("transition_application", { p_id: app.id, p_to: "cancelled", p_reason: "cancelled by traveler", p_source: "user", p_actor: ownerId, p_only_from: ["paid", "pre_check", "action_required", "submission_failed"] });
  if (error || (row as { status?: string } | null)?.status !== "cancelled") return { ok: false, error: "err_bad_transition" };
  const { refundUnusedAddons } = await import("@/lib/payments/service");
  const refunded = await refundUnusedAddons(app.id, "cancelled by traveler").catch(() => 0);
  await audit({ actorId: ownerId, action: "application.cancel", entity: "application", entityId: app.id, detail: { refunded_thb: refunded } });
  return { ok: true, refundedThb: refunded };
}

/** Applications that wait in pre_check without a queue entry (for example the insurance document has arrived since): look at them again. */
export async function recheckWaiting(limit = 30): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.from("applications").select("id").eq("status", "pre_check").order("updated_at").limit(limit);
  let n = 0;
  for (const a of data ?? []) { const { count } = await db.from("immigration_outbox").select("id", { count: "exact", head: true }).eq("application_id", a.id); if ((count ?? 0) === 0 && (await runPreCheck(a.id)) !== "skipped") n++; }
  return n;
}
