"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/ratelimit";
import { addMember, applyForPartner, membershipOf, redeemVoucher, removeMember, savePackage } from "@/lib/partner-portal/service";
import type { ActionResult } from "@/components/ActionForm";

const me = async () => (await getViewer()).user;

export async function applyPartnerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`partner:apply:${u.id}`, 3, 86400))) return { ok: false, error: "err_rate_limited" };
  const r = await applyForPartner(u.id, Object.fromEntries(fd)); if (!r.ok) return r;
  revalidatePath("/partner"); return { ok: true };
}
export async function redeemAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`partner:redeem:${u.id}`, 60, 600))) return { ok: false, error: "err_rate_limited" };          // stops guessing codes
  const r = await redeemVoucher(u.id, String(fd.get("code") ?? "")); if (!r.ok) return r;
  const { t } = await getT(); revalidatePath("/partner");
  return { ok: true, message: t.partner_redeemed.replace("{item}", r.item) };
}
export async function savePackageAction(code: string | null, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const num = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? undefined : v; };
  const r = await savePackage(u.id, { category: fd.get("category"), name: fd.get("name"), detail: fd.get("detail") ?? "", terms: fd.get("terms") ?? "", price_thb: fd.get("price_thb"), price_usd: num("price_usd"), price_cny: num("price_cny"), active: fd.get("active") === "on" }, code ?? undefined);
  if (!r.ok) return r;
  revalidatePath("/partner"); revalidatePath("/extras"); return { ok: true };
}
export async function addPartnerMemberAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const m = await membershipOf(u.id); if (!m) return { ok: false, error: "err_forbidden" };
  const r = await addMember(u.id, m.partner.id, String(fd.get("email") ?? "")); if (!r.ok) return r;
  revalidatePath("/partner"); return { ok: true };
}
export async function removePartnerMemberAction(userId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const m = await membershipOf(u.id); if (!m) return { ok: false, error: "err_forbidden" };
  if (!(await removeMember(u.id, m.partner.id, userId))) return { ok: false, error: "err_forbidden" };
  revalidatePath("/partner"); return { ok: true };
}
