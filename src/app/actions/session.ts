"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { hasSupabase } from "@/lib/env";
import { isLang, LANG_COOKIE } from "@/lib/i18n/langs";

export async function setLangAction(lang: string): Promise<void> {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const v = await getViewer();
  if (v.user) {
    // Keep the language with the account so it follows the user to other devices. Count rows, do not trust "no error".
    const { data } = await (await createClient()).from("profiles").update({ lang }).eq("id", v.user.id).select("id");
    if (!data || data.length !== 1) console.error("[lang] profile update matched no row");
    void trackEvent(v.user.id, "language_change", lang.replace(/[^a-z0-9]/gi, "_").toLowerCase());
  }
  revalidatePath("/", "layout");
}

export async function signOutAction(): Promise<void> {
  if (hasSupabase()) {
    const v = await getViewer();
    await (await createClient()).auth.signOut();
    if (v.user) await audit({ actorId: v.user.id, action: "auth.signout" });
  }
  revalidatePath("/", "layout");
  redirect("/");
}
