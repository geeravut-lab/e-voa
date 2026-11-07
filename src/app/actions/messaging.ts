"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/ratelimit";
import { confirmWhatsapp, disconnectChannel, startLineLink, startWhatsapp, type Channel } from "@/lib/messaging/service";
import { notifyUser } from "@/lib/notify";
import type { ActionResult } from "@/components/ActionForm";

const who = async () => (await getViewer()).user;

export async function startLineLinkAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`chan:line:${u.id}`, 10, 3600))) return { ok: false, error: "err_rate_limited" };
  const r = await startLineLink(u.id); if (!r.ok) return r;
  revalidatePath("/account/notifications"); const { t } = await getT();
  return { ok: true, message: t.chat_line_instruction.replace("{id}", r.basicId).replace("{code}", r.code) };
}
export async function startWhatsappAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`chan:wa:${u.id}`, 3, 3600))) return { ok: false, error: "err_rate_limited" };
  const r = await startWhatsapp(u.id, String(fd.get("phone") ?? "")); if (!r.ok) return r;
  revalidatePath("/account/notifications"); const { t } = await getT();
  return { ok: true, message: t.chat_wa_sent };
}
export async function confirmWhatsappAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`chan:wa:confirm:${u.id}`, 12, 3600))) return { ok: false, error: "err_rate_limited" };
  const r = await confirmWhatsapp(u.id, String(fd.get("code") ?? "")); if (!r.ok) return r;
  revalidatePath("/account/notifications"); return { ok: true };
}
export async function disconnectChannelAction(channel: Channel, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (channel !== "line" && channel !== "whatsapp") return { ok: false, error: "err_generic" };
  if (!(await disconnectChannel(u.id, channel))) return { ok: false, error: "err_not_found" };
  revalidatePath("/account/notifications"); return { ok: true };
}
export async function testChannelsAction(_p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`chan:test:${u.id}`, 5, 3600))) return { ok: false, error: "err_rate_limited" };
  const { t } = await getT();
  await notifyUser({ userId: u.id, title: t.notif_test_title, body: t.notif_test_body, kind: "test", link: "/account/notifications" });
  return { ok: true, message: t.chat_test_sent };
}

/** Step 0 of the LINE guide: a fresh one-time code and the official account to add. The code is shown once on screen (only a hash is kept), so the page keeps it in memory while the traveler follows the steps. */
export async function startLineGuideAction(): Promise<{ ok: true; code: string; basicId: string } | { ok: false; error: string }> {
  const u = await who(); if (!u) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`chan:line:${u.id}`, 10, 3600))) return { ok: false, error: "err_rate_limited" };
  const r = await startLineLink(u.id); if (!r.ok) return r;
  revalidatePath("/account/notifications");
  return { ok: true, code: r.code, basicId: r.basicId };
}
