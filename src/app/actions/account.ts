"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notify";
import { assertFeature } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import type { ActionResult } from "@/components/ActionForm";

export async function sendTestNotification(): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: "err_not_signed_in" };
  const off = await assertFeature("notifications");
  if (off) return { ok: false, error: off };
  const { t } = await getT();
  const ok = await notifyUser({ userId: v.user.id, title: t.notif_test_title, body: t.notif_test_body, kind: "test", link: "/notifications" });
  return ok ? { ok: true } : { ok: false, error: "err_not_configured" };
}

export async function markAllRead(): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: "err_not_signed_in" };
  // RLS limits this to the caller's own rows and the column grant limits it to read_at.
  const { error } = await (await createClient()).from("app_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) { console.error("[notif] mark read failed", error.message); return { ok: false, error: "err_generic" }; }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Opening one notice marks it as read (only the caller's own row can change: RLS). Returns where to go. */
export async function openNotification(id: string): Promise<{ link: string | null }> {
  const v = await getViewer();
  if (!v.user || !/^[0-9a-f-]{36}$/i.test(id)) return { link: null };
  const db = await createClient();
  const { data } = await db.from("app_notifications").select("link, read_at").eq("id", id).maybeSingle();
  if (data && !data.read_at) {
    const { error } = await db.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    if (error) console.error("[notif] mark read failed", error.message);
    revalidatePath("/", "layout");                         // the bell and the "More" dot lose their count
  }
  return { link: data?.link && data.link.startsWith("/") && !data.link.startsWith("//") ? data.link : null };
}
