import "server-only";
import { hasServiceRole, SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailConfigured, renderMail, sendMail } from "@/lib/mailer";
import { DICTS } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import { loadBrand } from "@/lib/brand/server";
import { sendToChannels } from "@/lib/messaging/service";

/**
 * The only writer of in-app notifications. Inserting a row also wakes the user's open pages (database trigger → live ping).
 * `dedupeKey` makes one event notify once even if the code path runs again. Never throws.
 */
export async function notifyUser(n: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
  kind?: string;
  dedupeKey?: string;
  mail?: boolean;                 // default true: also send the message by e-mail when mail is configured
}): Promise<boolean> {
  if (!hasServiceRole()) return false;
  try {
    const { error } = await createAdminClient().from("app_notifications").insert({
      user_id: n.userId,
      title: n.title.slice(0, 120),
      body: n.body?.slice(0, 400) ?? null,
      link: n.link ?? null,
      kind: n.kind ?? "info",
      dedupe_key: n.dedupeKey ?? null,
    });
    if (error && error.code !== "23505") {
      console.error("[notify] insert failed", error.message);
      return false;
    }
    if (!error && n.kind !== "test" && n.mail !== false) await mailToo(n);          // a repeated event (duplicate) is not mailed twice
    if (!error) await chatToo(n);                                                    // same for LINE / WhatsApp (only users who linked an account)
    return true;
  } catch (e) {
    console.error("[notify] insert failed", (e as Error).message);
    return false;
  }
}

/** Same message by e-mail when mail is configured and the user has an address. Best effort: a mail problem never undoes the notification. */
async function mailToo(n: { userId: string; title: string; body?: string; link?: string }) {
  if (!mailConfigured()) return;
  try {
    const { data: p } = await createAdminClient().from("profiles").select("email, lang").eq("id", n.userId).maybeSingle();
    if (!p?.email) return;
    const t = DICTS[isLang(p.lang) ? p.lang : "en"];
    const brand = (await loadBrand()).name;
    const { html, text } = renderMail({ brand, title: n.title, lines: n.body ? [n.body] : [], button: n.link ? { text: t.mail_open, url: `${SITE_URL}${n.link}` } : undefined, footer: t.mail_footer });
    await sendMail({ to: p.email, subject: `${brand}: ${n.title}`, html, text });
  } catch (e) { console.error("[notify] mail failed", (e as Error).message); }
}

async function chatToo(n: { userId: string; title: string; body?: string; link?: string; kind?: string }) {
  try { await sendToChannels(n); } catch (e) { console.error("[notify] chat failed", (e as Error).message); }
}
