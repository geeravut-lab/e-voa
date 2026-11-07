"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { addWatch, removeWatch } from "@/lib/conditions/watch";
import type { ActionResult } from "@/components/ActionForm";

/** Switch the notices for official warnings in one place on or off for the signed-in traveler. */
export async function setWatchAction(slug: string, on: boolean, _p: ActionResult, _fd: FormData): Promise<ActionResult> {
  const v = await requireUser(`/conditions?place=${encodeURIComponent(String(slug).slice(0, 40))}`);
  if (!(await rateLimit(`watch:${v.user.id}`, 30, 3600))) return { ok: false, error: "err_rate_limited" };
  if (!/^[a-z-]{2,40}$/.test(slug)) return { ok: false, error: "err_generic" };
  const r = on ? await addWatch(v.user.id, slug) : ((await removeWatch(v.user.id, slug)), "ok" as const);
  if (r !== "ok") return { ok: false, error: r };
  revalidatePath("/conditions"); return { ok: true };
}
