import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Profile = { id: string; display_name: string | null; email: string | null; avatar_url: string | null; lang: string };
export type Viewer = { user: User | null; profile: Profile | null; isAdmin: boolean; isOwner: boolean };

const VISITOR: Viewer = { user: null, profile: null, isAdmin: false, isOwner: false };

/** Who is looking at this page? Read once per request. If Supabase is missing or unreachable the visitor view is used. */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!hasSupabase()) return VISITOR;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return VISITOR;
    const [profile, admin] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email, avatar_url, lang").eq("id", user.id).maybeSingle(),
      supabase.from("admins").select("is_owner").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      user,
      profile: (profile.data as Profile | null) ?? null,
      isAdmin: !!admin.data,
      isOwner: !!admin.data?.is_owner,
    };
  } catch (e) {
    console.error("[auth] viewer lookup failed", (e as Error).message);
    return VISITOR;
  }
});

export async function requireUser(next = "/"): Promise<Viewer & { user: User }> {
  const v = await getViewer();
  if (!v.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v as Viewer & { user: User };
}

/** Pages: anyone who is not an admin gets a plain 404 (the area is not advertised). */
export async function requireAdminPage(): Promise<Viewer & { user: User }> {
  const v = await getViewer();
  if (!v.user || !v.isAdmin) notFound();
  return v as Viewer & { user: User };
}

/** Server actions: first line. Returns the viewer or an error code for the form. */
export async function requireAdminAction(): Promise<{ ok: true; viewer: Viewer & { user: User } } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: "err_not_signed_in" };
  if (!v.isAdmin) return { ok: false, error: "err_forbidden" };
  return { ok: true, viewer: v as Viewer & { user: User } };
}

export const displayNameOf = (v: Viewer) =>
  v.profile?.display_name || v.user?.user_metadata?.full_name || v.user?.email?.split("@")[0] || "";
