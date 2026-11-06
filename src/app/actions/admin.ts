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
