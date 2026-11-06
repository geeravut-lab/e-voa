"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/ratelimit";
import { addMember, applyForAgency, importTravelers, membershipOf, removeMember } from "@/lib/agency/service";
import type { ActionResult } from "@/components/ActionForm";

const me = async () => (await getViewer()).user;

export async function applyAgencyAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`agency:apply:${u.id}`, 3, 86400))) return { ok: false, error: "err_rate_limited" };
  const f = fd.get("doc"); const doc = f instanceof File && f.size > 0 ? new Uint8Array(await f.arrayBuffer()) : undefined;
  const r = await applyForAgency(u.id, Object.fromEntries(fd), doc); if (!r.ok) return r;
  revalidatePath("/agency"); return { ok: true };
}
export async function addMemberAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const m = await membershipOf(u.id); if (!m) return { ok: false, error: "err_forbidden" };
  const r = await addMember(u.id, m.agency.id, String(fd.get("email") ?? "")); if (!r.ok) return r;
  revalidatePath("/agency/team"); return { ok: true };
}
export async function removeMemberAction(userId: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const m = await membershipOf(u.id); if (!m) return { ok: false, error: "err_forbidden" };
  if (!(await removeMember(u.id, m.agency.id, userId))) return { ok: false, error: "err_forbidden" };
  revalidatePath("/agency/team"); return { ok: true };
}
export async function importTravelersAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await me(); if (!u) return { ok: false, error: "err_not_signed_in" };
  const m = await membershipOf(u.id); if (!m || m.agency.status !== "active") return { ok: false, error: "err_forbidden" };
  if (!(await rateLimit(`agency:import:${u.id}`, 20, 3600))) return { ok: false, error: "err_rate_limited" };
  const file = fd.get("file"); const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("text") ?? "");
  if (!text.trim()) return { ok: false, error: "err_file_missing" };
  const r = await importTravelers(u.id, text); const { t } = await getT();
  if (r.fatal) return { ok: false, error: "err_csv_bad" };
  revalidatePath("/travelers");
  const head = t.agency_import_done.replace("{created}", String(r.created)).replace("{updated}", String(r.updated)).replace("{errors}", String(r.errors.length));
  return { ok: true, message: r.errors.length ? `${head} ${t.agency_import_rows}: ${r.errors.slice(0, 8).map((e) => `${e.row} (${e.message})`).join("; ")}` : head };
}
