"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/ratelimit";
import { eraseAccount } from "@/lib/privacy/service";
import { mailConfigured, renderMail, sendMail } from "@/lib/mailer";
import { loadBrand } from "@/lib/brand/server";
import { DICTS } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import type { ActionResult } from "@/components/ActionForm";

/** "Delete my account": the person types their e-mail (or DELETE when they have none) and ticks the box. A goodbye e-mail goes out first, then the data is erased and the session ends. */
export async function eraseAccountAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const v = await getViewer(); if (!v.user) return { ok: false, error: "err_not_signed_in" };
  if (!(await rateLimit(`erase:${v.user.id}`, 5, 3600))) return { ok: false, error: "err_rate_limited" };
  const email = (v.user.email ?? "").trim().toLowerCase(), typed = String(fd.get("confirm") ?? "").trim().toLowerCase();
  if (!(email ? typed === email : typed === "delete")) return { ok: false, error: "err_erase_confirm" };
  if (fd.get("understand") !== "on") return { ok: false, error: "err_consent_required" };
  // refuse early (before any mail) when something blocks the erasure
  const { erasureBlockers } = await import("@/lib/privacy/service");
  const blockers = await erasureBlockers(v.user.id); if (blockers.length) return { ok: false, error: blockers[0] };
  const { data: p } = await createAdminClient().from("profiles").select("email, lang").eq("id", v.user.id).maybeSingle();
  const r = await eraseAccount(v.user.id); if (!r.ok) return r;
  if (mailConfigured() && p?.email) {
    const t = DICTS[isLang(p.lang) ? p.lang : "en"], brand = (await loadBrand()).name;
    const { html, text } = renderMail({ brand, title: t.privacy_mail_title, lines: [t.privacy_mail_body], footer: t.mail_footer });
    await sendMail({ to: p.email, subject: `${brand}: ${t.privacy_mail_title}`, html, text, kind: "erase" });
  }
  await (await createClient()).auth.signOut().catch(() => {});
  redirect("/?erased=1");
}
