"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { limited, rateLimit } from "@/lib/ratelimit";
import { getLang } from "@/lib/i18n/server";
import { acceptContact, checkIn, inviteContact, leaveContact, removeContact, resendInvite, saveSchedule } from "@/lib/family/service";
import { famText, fam } from "@/lib/family/text";
import type { ActionResult } from "@/components/ActionForm";

const done = (message?: string): ActionResult => { revalidatePath("/family"); return { ok: true, message }; };

/** "I am safe" or "I need help" (with the position only when the traveler ticked it). */
export async function checkInAction(status: "safe" | "help", pos: { lat: number; lon: number } | null): Promise<ActionResult> {
  const v = await requireUser("/family");
  if (status !== "safe" && status !== "help") return { ok: false, error: "err_generic" };
  if (!(await rateLimit(`checkin:${status}:${v.user.id}`, status === "help" ? 6 : 60, 3600))) return { ok: false, error: "err_rate_limited" };
  const r = await checkIn(v.user.id, status, pos); if (!r.ok) return r;
  const t = famText(await getLang());
  return done(status === "safe" ? t.safe_sent : r.contacts === 0 ? t.no_contacts : t.help_sent);
}
export async function saveScheduleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = await requireUser("/family");
  const r = await saveSchedule(v.user.id, { enabled: fd.get("enabled") === "on", interval: fd.get("interval"), grace: fd.get("grace"), until: String(fd.get("until") ?? "") || null });
  return r.ok ? done(famText(await getLang()).sched_saved) : r;
}
export async function inviteContactAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = await requireUser("/family");
  if (!(await rateLimit(`family-invite:${v.user.id}`, 10, 86_400))) return { ok: false, error: "err_rate_limited" };
  const r = await inviteContact(v.user.id, { name: fd.get("name"), email: fd.get("email"), lang: fd.get("lang") });
  if (!r.ok) return r;
  const t = famText(await getLang());
  return done(r.mailed ? t.c_invited : `${t.c_nomail} ${r.link}`);
}
export async function resendInviteAction(id: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const v = await requireUser("/family");
  if (!(await rateLimit(`family-invite:${v.user.id}`, 10, 86_400))) return { ok: false, error: "err_rate_limited" };
  const r = await resendInvite(v.user.id, id); if (!r.ok) return r;
  const t = famText(await getLang());
  return done(r.mailed ? t.c_invited : `${t.c_nomail} ${r.link}`);
}
export async function removeContactAction(id: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const v = await requireUser("/family");
  return (await removeContact(v.user.id, id)) ? done(famText(await getLang()).c_removed) : { ok: false, error: "err_generic" };
}
/** The relative accepts or leaves through the secret link: no account, limited per visitor. */
export async function acceptContactAction(token: string, name: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  if (await limited("family-contact", 30, 600)) return { ok: false, error: "err_rate_limited" };
  if (!(await acceptContact(token))) return { ok: false, error: "err_generic" };
  revalidatePath(`/family/${token}`); return { ok: true, message: fam(famText(await getLang()).v_accepted, { name }) };
}
export async function leaveContactAction(token: string, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  if (await limited("family-contact", 30, 600)) return { ok: false, error: "err_rate_limited" };
  if (!(await leaveContact(token))) return { ok: false, error: "err_generic" };
  revalidatePath(`/family/${token}`); return { ok: true, message: famText(await getLang()).v_left };
}
