"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { saveBrandImage, resetBrandImage, saveBrandName, type BrandKind } from "@/lib/brand/server";
import { validBrandName } from "@/lib/brand/brand";
import { saveFlags, loadFlags } from "@/lib/flags";
import { FEATURE_KEYS } from "@/config/features";
import { putSetting, getSetting } from "@/lib/settings";
import type { ActionResult } from "@/components/ActionForm";

const done = (path: string): ActionResult => { revalidatePath("/", "layout"); revalidatePath(path); return { ok: true }; };

export async function saveBrandNameAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const name = String(fd.get("name") ?? "");
  if (!validBrandName(name)) return { ok: false, error: "err_name_invalid" };
  if (!(await saveBrandName(name, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "brand.name", entity: "brand", detail: { length: name.trim().length } });
  return done("/admin/branding");
}

export async function uploadBrandImageAction(kind: BrandKind, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "err_file_missing" };
  const res = await saveBrandImage(kind, new Uint8Array(await file.arrayBuffer()), a.viewer.user.id);
  if (!res.ok) return res;
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: `brand.${kind}.set`, entity: "brand", detail: { bytes: file.size } });
  return done("/admin/branding");
}

export async function resetBrandImageAction(kind: BrandKind, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const res = await resetBrandImage(kind, a.viewer.user.id);
  if (!res.ok) return res;
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: `brand.${kind}.reset`, entity: "brand" });
  return done("/admin/branding");
}

export async function saveFlagsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const before = await loadFlags();
  const next = Object.fromEntries(FEATURE_KEYS.map((k) => [k, fd.get(`flag_${k}`) === "on"])) as Record<(typeof FEATURE_KEYS)[number], boolean>;
  if (!(await saveFlags(next, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  const changed = FEATURE_KEYS.filter((k) => before[k] !== next[k]);
  // Changing the switches is always recorded, whichever ones moved.
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "feature.flags", entity: "feature_flags", detail: { changed: changed.join(",").slice(0, 70), count: changed.length } });
  return done("/admin/features");
}

export async function grantAdminAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const email = String(fd.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "err_email_invalid" };
  // The database function enforces the rules (caller is admin, account must already exist).
  const { error } = await (await createClient()).rpc("grant_admin", { p_email: email });
  if (error) return { ok: false, error: /err_[a-z_]+/.exec(error.message)?.[0] ?? "err_generic" };
  return done("/admin/admins");
}

export async function revokeAdminAction(userId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "err_generic" };
  const { error } = await (await createClient()).rpc("revoke_admin", { p_user: userId });
  if (error) return { ok: false, error: /err_[a-z_]+/.exec(error.message)?.[0] ?? "err_generic" };
  return done("/admin/admins");
}

const int = (v: FormDataEntryValue | null, min: number, max: number): number | null => {
  const s = String(v ?? "").trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

export async function saveSettingsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const visa = int(fd.get("visa_thb"), 0, 100_000);
  const regular = int(fd.get("regular_service_thb"), 0, 100_000);
  const express = int(fd.get("express_service_thb"), 0, 100_000);
  const days = int(fd.get("document_days"), 1, 3650);
  if ([visa, regular, express, days].some((n) => n === null)) return { ok: false, error: "err_number_invalid" };
  const uid = a.viewer.user.id;
  const oldFees = await getSetting<Record<string, number>>("fees", {});
  const ok1 = await putSetting("fees", { visa_thb: visa, regular_service_thb: regular, express_service_thb: express }, uid);
  const ok2 = await putSetting("retention", { document_days: days }, uid);
  if (!ok1 || !ok2) return { ok: false, error: "err_generic" };
  await audit({ actorId: uid, actorRole: "admin", action: "settings.update", entity: "settings", detail: { visa_thb: visa, regular_thb: regular, express_thb: express, document_days: days, prev_regular_thb: oldFees.regular_service_thb ?? null } });
  return done("/admin/settings");
}

const codes = (s: string) => [...new Set(s.toUpperCase().split(/[^A-Z]+/).filter((c) => /^[A-Z]{3}$/.test(c)))];
/** Who may apply for Visa on Arrival / who needs no visa: 3-letter nationality codes copied from the official announcement. */
export async function saveEligibilityAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const voa = codes(String(fd.get("voa") ?? "")), visa_free = codes(String(fd.get("visa_free") ?? ""));
  if (voa.some((c) => visa_free.includes(c))) return { ok: false, error: "err_elig_overlap" };
  if (!(await putSetting("eligibility", { voa, visa_free }, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.eligibility", entity: "settings", detail: { voa: voa.length, visa_free: visa_free.length } });
  return done("/admin/eligibility");
}

/** The addresses shown on the public "Official channels" page. Anything that is not a plain https link / e-mail / phone is dropped. */
export async function saveChannelsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { parseChannels } = await import("@/lib/channels");
  const value = parseChannels(Object.fromEntries(fd));
  if (!(await putSetting("official_channels", value, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.channels", entity: "settings" });
  return done("/admin/channels");
}

/** The seller's details printed on every tax invoice (name, tax id, address, VAT registration). Checked shape only: the accountant confirms the content. */
export async function saveCompanyAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { parseCompany } = await import("@/lib/invoice");
  const raw = Object.fromEntries(fd);
  const value = parseCompany({ ...raw, vat_registered: fd.get("vat_registered") === "on", visa_fee_pass_through: fd.get("visa_fee_pass_through") === "on" });
  if (String(raw.tax_id ?? "").trim() && !value.tax_id) return { ok: false, error: "err_tax_id" };
  if (!(await putSetting("company", value, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.company", entity: "settings" });
  return done("/admin/company");
}

/** Airport-specific notes for the public Airport guide, per airport and language (counters, lanes, hours): written by staff from the airport / Thai Immigration, never generated. */
export async function saveAirportNotesAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { parseAirportNotes } = await import("@/lib/airports");
  const raw: Record<string, Record<string, string>> = {};
  for (const [k, v] of fd.entries()) { const m = /^([A-Z]{3}):([A-Za-z-]+)$/.exec(k); if (m && typeof v === "string") (raw[m[1]] ??= {})[m[2]] = v; }
  if (!(await putSetting("airport_notes", parseAirportNotes(raw), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.airports", entity: "settings" });
  return done("/admin/airports");
}

/** The help assistant's switch, model and spending limits. A model name must look like a Claude model id; numbers are clamped to sane ranges. */
export async function saveAiAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { parseAi } = await import("@/lib/ai/settings");
  const raw = Object.fromEntries(fd);
  if (!/^claude-[a-z0-9.-]{3,40}$/.test(String(raw.model ?? ""))) return { ok: false, error: "err_ai_model" };
  if (!(await putSetting("ai", parseAi({ ...raw, enabled: fd.get("enabled") === "on" }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.ai", entity: "settings" });
  return done("/admin/ai");
}

/** LINE / WhatsApp: on-off and the monthly message quota of each channel (the quota keeps the bill predictable; notices past it still go to the app and e-mail). */
export async function saveMessagingAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { parseMessaging } = await import("@/lib/messaging/settings");
  const raw = Object.fromEntries(fd);
  if (!(await putSetting("messaging", parseMessaging({ ...raw, line_enabled: fd.get("line_enabled") === "on", whatsapp_enabled: fd.get("whatsapp_enabled") === "on" }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.messaging", entity: "settings" });
  return done("/admin/messaging");
}

/** Staff decide about an agency: approve, suspend, and the terms agreed with it (service-fee discount per application, commission on service fees). */
export async function setAgencyAction(agencyId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const status = String(fd.get("status") ?? ""), discount = Math.floor(Number(fd.get("discount_thb"))), pct = Number(fd.get("commission_pct"));
  if (!["pending", "active", "suspended"].includes(status) || !Number.isFinite(discount) || discount < 0 || discount > 600 || !Number.isFinite(pct) || pct < 0 || pct > 50) return { ok: false, error: "err_form_incomplete" };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const upd = await createAdminClient().from("agencies").update({ status, discount_thb: discount, commission_pct: pct, admin_note: String(fd.get("admin_note") ?? "").slice(0, 500), ...(status === "active" ? { approved_at: new Date().toISOString() } : {}) }).eq("id", agencyId).select("id");
  if (upd.data?.length !== 1) return { ok: false, error: "err_not_found" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "agency.update", entity: "agency", entityId: agencyId, detail: { status, discount, pct } });
  return done("/admin/agencies");
}

export async function setPartnerAction(partnerId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const status = String(fd.get("status") ?? ""), pct = Number(fd.get("settlement_pct"));
  if (!["pending", "active", "suspended"].includes(status) || !Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: "err_form_incomplete" };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const upd = await createAdminClient().from("partners").update({ status, settlement_pct: pct, portal_managed: fd.get("portal_managed") === "on", admin_note: String(fd.get("admin_note") ?? "").slice(0, 500), ...(status === "active" ? { approved_at: new Date().toISOString() } : {}) }).eq("id", partnerId).select("id");
  if (upd.data?.length !== 1) return { ok: false, error: "err_not_found" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "partner.update", entity: "partner", entityId: partnerId, detail: { status, pct } });
  return done("/admin/partners");
}
export async function settlePartnerAction(partnerId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const period = String(fd.get("period") ?? "");
  const { isPeriod } = await import("@/lib/partner-portal/rules");
  if (!isPeriod(period)) return { ok: false, error: "err_form_incomplete" };
  const { closeSettlement } = await import("@/lib/partner-portal/service");
  const r = await closeSettlement(a.viewer.user.id, partnerId, period, String(fd.get("note") ?? ""));
  if (!r.ok) return r;
  return done("/admin/partners");
}

export async function saveAuditConfigAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction();
  if (!a.ok) return a;
  const { AUDIT_CATEGORIES } = await import("@/lib/audit-config");
  const enabled = fd.get("enabled") === "on";
  const kept = new Set(fd.getAll("kind").map(String));
  const disabled = AUDIT_CATEGORIES.map((c) => c.id).filter((id) => !kept.has(id));          // a ticked kind is recorded; an unticked one is not
  const ok = await putSetting("audit_config", { enabled, disabled }, a.viewer.user.id);
  if (!ok) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.audit", entity: "audit_config", detail: { enabled, disabled: disabled.join(",") }, force: true });
  return done("/admin/audit");
}
