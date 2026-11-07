"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveBrandImage, resetBrandImage, saveBrandName, type BrandKind } from "@/lib/brand/server";
import { validBrandName } from "@/lib/brand/brand";
import { saveFlags, loadFlags } from "@/lib/flags";
import { FEATURE_KEYS } from "@/config/features";
import { putSetting, getSetting } from "@/lib/settings";
import type { ActionResult } from "@/components/ActionForm";

const done = (path: string): ActionResult => { revalidatePath("/", "layout"); revalidatePath(path); return { ok: true }; };

export async function saveBrandNameAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const name = String(fd.get("name") ?? "");
  if (!validBrandName(name)) return { ok: false, error: "err_name_invalid" };
  if (!(await saveBrandName(name, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "brand.name", entity: "brand", detail: { length: name.trim().length } });
  return done("/admin/branding");
}

export async function uploadBrandImageAction(kind: BrandKind, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "err_file_missing" };
  const res = await saveBrandImage(kind, new Uint8Array(await file.arrayBuffer()), a.viewer.user.id);
  if (!res.ok) return res;
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: `brand.${kind}.set`, entity: "brand", detail: { bytes: file.size } });
  return done("/admin/branding");
}

export async function resetBrandImageAction(kind: BrandKind, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const res = await resetBrandImage(kind, a.viewer.user.id);
  if (!res.ok) return res;
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: `brand.${kind}.reset`, entity: "brand" });
  return done("/admin/branding");
}

export async function saveFlagsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
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
  const a = await requireAdminAction("staff");
  if (!a.ok) return a;
  const email = String(fd.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "err_email_invalid" };
  // The database function enforces the rules (caller is admin, account must already exist).
  const role = String(fd.get("role") ?? "manager"); if (!isRole(role)) return { ok: false, error: "err_role_invalid" };
  const { error } = await (await createClient()).rpc("grant_admin", { p_email: email, p_role: role });
  if (error) return { ok: false, error: /err_[a-z_]+/.exec(error.message)?.[0] ?? "err_generic" };
  return done("/admin/admins");
}

/** The owner changes the role of another staff account. The owner's own row never changes. */
export async function setAdminRoleAction(userId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("staff");
  if (!a.ok) return a;
  const role = String(fd.get("role") ?? ""); if (!isRole(role) || !/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "err_role_invalid" };
  if (!a.viewer.isOwner) return { ok: false, error: "err_forbidden" };
  const upd = await createAdminClient().from("admins").update({ role }).eq("user_id", userId).eq("is_owner", false).select("user_id");     // a write that matches no row is not success
  if (upd.error || upd.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "staff.role", entity: "admins", entityId: userId, detail: { role } });
  return done("/admin/admins");
}

export async function revokeAdminAction(userId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("staff");
  if (!a.ok) return a;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "err_generic" };
  const { error } = await (await createClient()).rpc("revoke_admin", { p_user: userId });
  if (error) return { ok: false, error: /err_[a-z_]+/.exec(error.message)?.[0] ?? "err_generic" };
  return done("/admin/admins");
}

/** Gives an existing account read-only access to the tourism statistics (/gov). The account must already exist; nothing else in the back office opens for it. */
export async function grantReportViewerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("staff");
  if (!a.ok) return a;
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "err_email_invalid" };
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
  if (!p) return { ok: false, error: "err_gov_no_account" };
  const { error } = await db.from("report_viewers").upsert({ user_id: p.id, added_by: a.viewer.user.id }, { onConflict: "user_id" });
  if (error) { console.error("[tourism] grant failed", error.message); return { ok: false, error: "err_generic" }; }
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "tourism.viewer_add", entity: "profiles", entityId: p.id });
  return done("/admin/tourism");
}

export async function revokeReportViewerAction(userId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("staff");
  if (!a.ok) return a;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "err_generic" };
  const { data, error } = await createAdminClient().from("report_viewers").delete().eq("user_id", userId).select("user_id");
  if (error || data?.length !== 1) return { ok: false, error: "err_generic" };                  // a delete that matches nothing is not success
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "tourism.viewer_remove", entity: "profiles", entityId: userId });
  return done("/admin/tourism");
}

/** Creates a discount code. Percent 1–100 or a fixed baht amount; optional dates and limits. A code is never deleted afterwards, only turned off. */
export async function createDiscountAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
  if (!a.ok) return a;
  const { CODE_RE, normalizeCode } = await import("@/lib/discounts/rules");
  const code = normalizeCode(String(fd.get("code") ?? "")); if (!CODE_RE.test(code)) return { ok: false, error: "err_discount_code_format" };
  const kind = fd.get("kind") === "fixed" ? "fixed" : "percent", value = Number(fd.get("value"));
  if (!Number.isInteger(value) || value < 1 || (kind === "percent" ? value > 100 : value > 100_000)) return { ok: false, error: "err_number_invalid" };
  const date = (k: string): string | null | undefined => { const v = String(fd.get(k) ?? "").trim(); if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
  const from = date("valid_from"), to = date("valid_to"); if (from === undefined || to === undefined || (from && to && to < from)) return { ok: false, error: "err_number_invalid" };
  const maxRaw = String(fd.get("max_uses") ?? "").trim(), max = maxRaw ? Number(maxRaw) : null, per = Number(fd.get("per_user") || 1);
  if ((max !== null && (!Number.isInteger(max) || max < 1 || max > 1_000_000)) || !Number.isInteger(per) || per < 1 || per > 1000) return { ok: false, error: "err_number_invalid" };
  const { data, error } = await createAdminClient().from("discount_codes").insert({ code, kind, value, valid_from: from, valid_to: to, max_uses: max, per_user: per, note: String(fd.get("note") ?? "").trim().slice(0, 200) || null, created_by: a.viewer.user.id }).select("id");
  if (error?.code === "23505") return { ok: false, error: "err_discount_exists" };
  if (error || data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "discount.create", entity: "discount_code", entityId: data[0].id, detail: { code, kind, value } });
  return done("/admin/discounts");
}

export async function setDiscountActiveAction(id: string, active: boolean, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
  if (!a.ok) return a;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "err_generic" };
  const { data, error } = await createAdminClient().from("discount_codes").update({ active }).eq("id", id).select("id");
  if (error || data?.length !== 1) return { ok: false, error: "err_generic" };                  // a write that matches no row is not success
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: active ? "discount.on" : "discount.off", entity: "discount_code", entityId: id });
  return done("/admin/discounts");
}

// ---------------------------------------------------------------- FAQ and news (content_items)
/** Creates or updates one FAQ question, news item or travel article. English is required; Thai and Chinese are optional (a missing language shows the English text). */
export async function saveContentAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  const { cleanTexts, TITLE_MAX, BODY_MAX, ARTICLE_MAX, SUMMARY_MAX, validSlug, parseSections } = await import("@/lib/content/managed");
  const kindRaw = String(fd.get("kind") ?? ""), kind = kindRaw === "news" ? "news" : kindRaw === "article" ? "article" : "faq", idRaw = String(fd.get("id") ?? "");
  if (idRaw && !/^[0-9a-f-]{36}$/i.test(idRaw)) return { ok: false, error: "err_generic" };
  const pick = (name: string, max: number) => cleanTexts({ en: fd.get(`${name}_en`), th: fd.get(`${name}_th`), "zh-CN": fd.get(`${name}_zh`) }, max);
  const article = kind === "article", title = pick("title", TITLE_MAX), body = pick("body", article ? ARTICLE_MAX : BODY_MAX), summary = article ? pick("summary", SUMMARY_MAX) : null;
  if (!title.en || !body.en || (article && !summary?.en)) return { ok: false, error: "err_content_en_required" };
  if (article) for (const [l, t] of Object.entries(body)) if (parseSections(t as string).length === 0) return { ok: false, error: l === "en" ? "err_content_en_required" : "err_generic" };
  const slug = article && !idRaw ? String(fd.get("slug") ?? "").trim().toLowerCase() : null;
  if (article && !idRaw && !validSlug(slug ?? "")) return { ok: false, error: "err_content_slug_format" };
  const published = fd.get("published") === "on", pinned = kind === "news" && fd.get("pinned") === "on", sortN = Number(fd.get("sort") || 100), sort = Number.isInteger(sortN) && sortN >= 0 && sortN <= 9999 ? sortN : 100;
  const dateRaw = String(fd.get("date") ?? "").trim(), chosen = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && !Number.isNaN(Date.parse(`${dateRaw}T00:00:00+07:00`)) ? new Date(`${dateRaw}T00:00:00+07:00`).toISOString() : null;
  const db = createAdminClient(), now = new Date().toISOString();
  let id = idRaw;
  if (id) {
    const { data: old } = await db.from("content_items").select("published_at, kind").eq("id", id).maybeSingle();
    if (!old || old.kind !== kind) return { ok: false, error: "err_not_found" };
    const upd = await db.from("content_items").update({ title, body, ...(summary ? { summary } : {}), published, pinned, sort, published_at: chosen ?? (published ? old.published_at ?? now : old.published_at), updated_by: a.viewer.user.id, updated_at: now }).eq("id", id).select("id");
    if (upd.error || upd.data?.length !== 1) return { ok: false, error: "err_generic" };                  // a write that matches no row is not success
  } else {
    const ins = await db.from("content_items").insert({ kind, title, body, ...(summary ? { summary } : {}), ...(slug ? { slug } : {}), published, pinned, sort, published_at: chosen ?? (published ? now : null), created_by: a.viewer.user.id, updated_by: a.viewer.user.id }).select("id");
    if (ins.error?.code === "23505") return { ok: false, error: "err_content_slug_exists" };
    if (ins.error || ins.data?.length !== 1) return { ok: false, error: "err_generic" };
    id = ins.data[0].id;
  }
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: idRaw ? "content.update" : "content.create", entity: "content_item", entityId: id, detail: { kind, published } });
  revalidatePath("/help"); revalidatePath("/news"); revalidatePath("/articles"); revalidatePath("/", "layout");
  if (!idRaw) redirect(`/admin/content/${id}`);
  return done(`/admin/content/${id}`);
}

export async function deleteContentAction(id: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "err_generic" };
  const { data, error } = await createAdminClient().from("content_items").delete().eq("id", id).select("id, kind");
  if (error || data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "content.delete", entity: "content_item", entityId: id, detail: { kind: data[0].kind } });
  revalidatePath("/help"); revalidatePath("/news"); revalidatePath("/articles"); revalidatePath("/", "layout");
  redirect(`/admin/content?kind=${data[0].kind}`);
}

/** Copies the built-in travel articles (English, Thai, Chinese) into the editor, once, so every article can be edited, unpublished or replaced. */
export async function seedArticlesAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  const db = createAdminClient();
  const { count } = await db.from("content_items").select("id", { count: "exact", head: true }).eq("kind", "article");
  if ((count ?? 0) > 0) return { ok: false, error: "err_content_seed_exists" };
  const { ARTICLES } = await import("@/lib/content/articles"), { sectionsToText } = await import("@/lib/content/managed");
  const find = (lang: "th" | "zh-CN", slug: string) => ARTICLES[lang].find((x) => x.slug === slug);
  const rows = ARTICLES.en.map((e, i) => { const th = find("th", e.slug), zh = find("zh-CN", e.slug);
    return { kind: "article", slug: e.slug, title: { en: e.title, ...(th ? { th: th.title } : {}), ...(zh ? { "zh-CN": zh.title } : {}) }, summary: { en: e.summary, ...(th ? { th: th.summary } : {}), ...(zh ? { "zh-CN": zh.summary } : {}) },
      body: { en: sectionsToText(e.body), ...(th ? { th: sectionsToText(th.body) } : {}), ...(zh ? { "zh-CN": sectionsToText(zh.body) } : {}) }, published: true, sort: (i + 1) * 10, published_at: `${e.date}T00:00:00+07:00`, created_by: a.viewer.user.id, updated_by: a.viewer.user.id }; });
  const { data, error } = await db.from("content_items").insert(rows).select("id");
  if (error || data?.length !== rows.length) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "content.seed_articles", entity: "content_item", detail: { count: rows.length } });
  revalidatePath("/articles");
  return done("/admin/content");
}

/** Copies the built-in FAQ (English, Thai, Chinese) into the editor, once, so every question can be edited or hidden. */
export async function seedFaqAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  const db = createAdminClient();
  const { count } = await db.from("content_items").select("id", { count: "exact", head: true }).eq("kind", "faq");
  if ((count ?? 0) > 0) return { ok: false, error: "err_content_seed_exists" };
  const { FAQ } = await import("@/lib/content/faq");
  const rows = FAQ.en.map((q, i) => ({ kind: "faq", title: { en: q.q, ...(FAQ.th[i] ? { th: FAQ.th[i].q } : {}), ...(FAQ["zh-CN"][i] ? { "zh-CN": FAQ["zh-CN"][i].q } : {}) }, body: { en: q.a, ...(FAQ.th[i] ? { th: FAQ.th[i].a } : {}), ...(FAQ["zh-CN"][i] ? { "zh-CN": FAQ["zh-CN"][i].a } : {}) }, published: true, sort: (i + 1) * 10, created_by: a.viewer.user.id, updated_by: a.viewer.user.id }));
  const { data, error } = await db.from("content_items").insert(rows).select("id");
  if (error || data?.length !== rows.length) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "content.seed_faq", entity: "content_item", detail: { count: rows.length } });
  revalidatePath("/help");
  return done("/admin/content");
}

/** Runs (or re-runs) the reconciliation of one Thai day. */
export async function runReconcileAction(day: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
  if (!a.ok) return a;
  const { thaiDayRange, yesterdayThai } = await import("@/lib/reconcile/rules");
  if (!thaiDayRange(day) || day > yesterdayThai(new Date(Date.now() + 86_400_000))) return { ok: false, error: "err_number_invalid" };
  const { reconcileDay } = await import("@/lib/reconcile/service");
  const r = await reconcileDay(day);
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "reconcile.run", entity: "reconciliation", detail: { day, status: r.status } });
  if (r.status === "error") return { ok: false, error: "err_generic" };
  return done("/admin/reconcile");
}

/** "I have looked at these differences": the day stops asking for attention. */
export async function reviewReconcileAction(day: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
  if (!a.ok) return a;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "err_generic" };
  const { data, error } = await createAdminClient().from("reconciliation_reports").update({ reviewed_at: new Date().toISOString(), reviewed_by: a.viewer.user.id }).eq("day", day).select("day");
  if (error || data?.length !== 1) return { ok: false, error: "err_generic" };                  // a write that matches no row is not success
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "reconcile.review", entity: "reconciliation", detail: { day } });
  return done("/admin/reconcile");
}

const int = (v: FormDataEntryValue | null, min: number, max: number): number | null => {
  const s = String(v ?? "").trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

export async function saveSettingsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
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
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const voa = codes(String(fd.get("voa") ?? "")), visa_free = codes(String(fd.get("visa_free") ?? ""));
  if (voa.some((c) => visa_free.includes(c))) return { ok: false, error: "err_elig_overlap" };
  if (!(await putSetting("eligibility", { voa, visa_free }, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.eligibility", entity: "settings", detail: { voa: voa.length, visa_free: visa_free.length } });
  return done("/admin/eligibility");
}

/** The addresses shown on the public "Official channels" page. Anything that is not a plain https link / e-mail / phone is dropped. */
export async function saveChannelsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { parseChannels } = await import("@/lib/channels");
  const value = parseChannels(Object.fromEntries(fd));
  if (!(await putSetting("official_channels", value, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.channels", entity: "settings" });
  return done("/admin/channels");
}

/** The seller's details printed on every tax invoice (name, tax id, address, VAT registration). Checked shape only: the accountant confirms the content. */
export async function saveCompanyAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
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
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  const { parseAirportNotes } = await import("@/lib/airports");
  const raw: Record<string, Record<string, string>> = {};
  for (const [k, v] of fd.entries()) { const m = /^([A-Z]{3}):([A-Za-z-]+)$/.exec(k); if (m && typeof v === "string") (raw[m[1]] ??= {})[m[2]] = v; }
  if (!(await putSetting("airport_notes", parseAirportNotes(raw), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.airports", entity: "settings" });
  return done("/admin/airports");
}

/** The help assistant's switch and spending limits (which provider and model answer is saved by saveAiRoutingAction). Numbers are clamped to sane ranges. */
export async function saveAiAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { parseAi } = await import("@/lib/ai/settings");
  const raw = Object.fromEntries(fd);
  if (!(await putSetting("ai", parseAi({ ...raw, enabled: fd.get("enabled") === "on" }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.ai", entity: "settings" });
  return done("/admin/ai");
}

/** Which provider answers each task, which one is the spare, and which model each provider uses. A model name is checked for shape only; "Test" asks the provider for real. */
export async function saveAiRoutingAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { parseRouting } = await import("@/lib/ai/route");
  const { PROVIDERS, MODEL_RE } = await import("@/lib/ai/registry");
  const { PROVIDER_IDS, TASK_KINDS } = await import("@/lib/ai/types");
  const { keyFor } = await import("@/lib/ai/server");
  const routes: Record<string, unknown> = {}, models: Record<string, Record<string, string>> = {};
  for (const t of TASK_KINDS) {
    const primary = String(fd.get(`primary_${t}`) ?? ""), fallback = String(fd.get(`fallback_${t}`) ?? "");
    if (primary && !keyFor(primary as never)) return { ok: false, error: "err_ai_nokey" };          // a provider without a key cannot be chosen
    routes[t] = { primary, fallback };
    for (const p of PROVIDER_IDS) {
      const m = (String(fd.get(`model_${p}_${t}__custom`) ?? "").trim() || String(fd.get(`model_${p}_${t}`) ?? "").trim());          // a typed name wins over the list
      if (m && m !== PROVIDERS[p].models[t]) { if (!MODEL_RE.test(m)) return { ok: false, error: "err_ai_model" }; (models[p] ??= {})[t] = m; }      // only a changed name is stored; the default stays in code
    }
  }
  if (!(await putSetting("ai_routing", parseRouting({ routes, models }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.ai_routing", entity: "settings" });
  return done("/admin/ai");
}

/** The Test button: one real call to the chosen provider and model, bypassing routing. */
export async function testAiModelAction(provider: string, model: string): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { isProvider, MODEL_RE } = await import("@/lib/ai/registry");
  if (!isProvider(provider) || !MODEL_RE.test(model)) return { ok: false, error: "err_ai_model" };
  const { testModel } = await import("@/lib/ai/server");
  const r = await testModel(provider, model);
  return r.ok ? { ok: true, message: `✓ ${r.ms} ms` } : { ok: false, error: r.error };
}

/** The administrator's added instructions: screened by code, then read by a small model; only text that passes both is saved, and every saved text stays in the history. */
export async function savePromptExtraAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("content");
  if (!a.ok) return a;
  const { parseExtra, EXTRA_MAX } = await import("@/lib/ai/extra");
  const { reviewPromptAddition } = await import("@/lib/ai/server");
  const text = String(fd.get("text") ?? "").trim(), enabled = fd.get("enabled") === "on";
  if (text.length > EXTRA_MAX) return { ok: false, error: "err_prompt_long" };
  if (text) { const r = await reviewPromptAddition(text); if (!r.ok) return { ok: false, error: r.error }; }
  const db = createAdminClient();
  const { data: last } = await db.from("ai_prompt_versions").select("body").eq("task", "chat").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if ((last?.body ?? "") !== text) {
    const { data: ins } = await db.from("ai_prompt_versions").insert({ task: "chat", body: text, created_by: a.viewer.user.id }).select("id");
    if (ins?.length !== 1) return { ok: false, error: "err_generic" };
  }
  if (!(await putSetting("ai_prompt_extra", parseExtra({ chat: { enabled, text } }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.ai_prompt", entity: "settings" });      // the text itself is in the history table, not in the audit log
  return done("/admin/prompts");
}

/** LINE / WhatsApp: on-off and the monthly message quota of each channel (the quota keeps the bill predictable; notices past it still go to the app and e-mail). */
export async function saveMessagingAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { parseMessaging } = await import("@/lib/messaging/settings");
  const raw = Object.fromEntries(fd);
  if (!(await putSetting("messaging", parseMessaging({ ...raw, line_enabled: fd.get("line_enabled") === "on", whatsapp_enabled: fd.get("whatsapp_enabled") === "on" }), a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.messaging", entity: "settings" });
  return done("/admin/messaging");
}

/** Staff decide about an agency: approve, suspend, and the terms agreed with it (service-fee discount per application, commission on service fees). */
export async function setAgencyAction(agencyId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
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
  const a = await requireAdminAction("config");
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
  const a = await requireAdminAction("finance");
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
  const a = await requireAdminAction("config");
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

export async function saveRulesAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { parseRules } = await import("@/lib/rules/rules");
  const on = (k: string) => fd.get(k) === "on", n = (k: string) => Number(fd.get(k));
  const cfg = parseRules({
    payment_reminder: { enabled: on("pr_on"), after_hours: n("pr_h") }, unpaid_expire: { enabled: on("ue_on"), after_days: n("ue_d") }, fix_reminder: { enabled: on("fr_on"), after_hours: n("fr_h") },
    sla_warning: { enabled: on("sw_on"), before_hours: n("sw_h") }, sla_overdue: { enabled: on("so_on") },
    expiry_warning: { enabled: on("ew_on"), before_hours: n("ew_h") }, flight_reminder: { enabled: on("fl_on"), before_hours: n("fl_h") }, stay_guard: { enabled: on("sg_on"), stay_days: n("sg_d") },
  });
  if (!(await putSetting("automation_rules", cfg, a.viewer.user.id))) return { ok: false, error: "err_generic" };
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.rules", entity: "automation_rules", detail: { pr: cfg.payment_reminder.enabled, ue: cfg.unpaid_expire.enabled, fr: cfg.fix_reminder.enabled, sw: cfg.sla_warning.enabled, so: cfg.sla_overdue.enabled } });
  return done("/admin/rules");
}
export async function runRulesAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("config");
  if (!a.ok) return a;
  const { runRules } = await import("@/lib/rules/service");
  const r = await runRules();
  await audit({ actorId: a.viewer.user.id, actorRole: "admin", action: "settings.rules_run", entity: "automation_rules", detail: { reminders: r.payment_reminders, expired: r.expired, fix: r.fix_reminders, warn: r.sla_warnings, late: r.sla_overdue } });
  return done("/admin/rules");
}

export async function payAgencyCommissionAction(agencyId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await requireAdminAction("finance");
  if (!a.ok) return a;
  const period = String(fd.get("period") ?? "");
  const { isPeriod } = await import("@/lib/partner-portal/rules");
  if (!isPeriod(period)) return { ok: false, error: "err_form_incomplete" };
  const { closePayout } = await import("@/lib/agency/service");
  const r = await closePayout(a.viewer.user.id, agencyId, period, String(fd.get("note") ?? ""));
  if (!r.ok) return r;
  return done("/admin/agencies");
}
