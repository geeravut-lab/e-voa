"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashId } from "@/lib/crypto";
import { clientId, rateLimit } from "@/lib/ratelimit";
import { statusHint, statusLabel } from "@/components/StatusBadge";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/ActionForm";

const Q = z.object({ ref: z.string().trim().toUpperCase().regex(/^EV-\d{2}-\d{6}$/), passport: z.string().trim().min(5).max(15), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Status without signing in. Three things must match (reference + passport number + date of birth) and every miss gives the SAME answer,
 * so nobody can learn whether a reference exists. Limited per visitor and per reference. Shows only the status and what it means.
 */
export async function checkStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const who = await clientId();
  if (!(await rateLimit(`status:ip:${who}`, 10, 600))) return { ok: false, error: "err_rate_limited" };
  const q = Q.safeParse(Object.fromEntries(fd));
  if (!q.success) return { ok: false, error: "err_status_not_found" };
  if (!(await rateLimit(`status:ref:${q.data.ref}`, 8, 3600))) return { ok: false, error: "err_rate_limited" };
  const db = createAdminClient();
  const { data: a } = await db.from("applications").select("id, status, traveler_id, updated_at").eq("ref_no", q.data.ref).maybeSingle();
  const { data: t } = a ? await db.from("travelers").select("passport_no_hash, date_of_birth").eq("id", a.traveler_id).maybeSingle() : { data: null };
  if (!a || !t || t.passport_no_hash !== hashId(q.data.passport) || t.date_of_birth !== q.data.dob) return { ok: false, error: "err_status_not_found" };
  const { t: dict } = await getT();
  return { ok: true, message: `${statusLabel(dict, a.status)} — ${statusHint(dict, a.status)}` };
}

/** Removes a saved traveler that is not on any application. */
export async function deleteTravelerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = await getViewer(); if (!v.user) return { ok: false, error: "err_not_signed_in" };
  const id = String(fd.get("travelerId") ?? ""); if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "err_not_found" };
  const db = createAdminClient();
  const { count } = await db.from("applications").select("id", { count: "exact", head: true }).eq("traveler_id", id).eq("owner_id", v.user.id);
  if ((count ?? 0) > 0) return { ok: false, error: "err_traveler_in_use" };
  const del = await db.from("travelers").delete().eq("id", id).eq("owner_id", v.user.id).select("id");
  if (del.data?.length !== 1) return { ok: false, error: "err_not_found" };
  await audit({ actorId: v.user.id, action: "traveler.delete", entity: "traveler", entityId: id });
  revalidatePath("/travelers");
  return { ok: true };
}
