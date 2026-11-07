import "server-only";
import { cache } from "react";
import { redirect, notFound, unstable_rethrow } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { capsOf, can, type Cap, type Role, isRole } from "@/lib/roles";

export type Profile = { id: string; display_name: string | null; email: string | null; avatar_url: string | null; lang: string };
export type Viewer = { user: User | null; profile: Profile | null; isAdmin: boolean; isOwner: boolean; isReportViewer: boolean; role: Role | null; caps: readonly Cap[] };

const VISITOR: Viewer = { user: null, profile: null, isAdmin: false, isOwner: false, isReportViewer: false, role: null, caps: [] };

type AdminRow = { is_owner: boolean; role: string | null } | null;
/** The staff row of one account. If the role column is not there yet (code deployed before the migration) every staff account counts as "manager" instead of being locked out. */
async function adminRow(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<AdminRow> {
  const r = await supabase.from("admins").select("is_owner, role").eq("user_id", id).maybeSingle();
  if (!r.error) return (r.data as AdminRow) ?? null;
  const old = await supabase.from("admins").select("is_owner").eq("user_id", id).maybeSingle();
  return old.data ? { is_owner: !!old.data.is_owner, role: "manager" } : null;
}

/** Who is looking at this page? Read once per request. If Supabase is missing or unreachable the visitor view is used. */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!hasSupabase()) return VISITOR;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return VISITOR;
    const [profile, admin, reportViewer] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email, avatar_url, lang").eq("id", user.id).maybeSingle(),
      adminRow(supabase, user.id),
      supabase.from("report_viewers").select("user_id").eq("user_id", user.id).maybeSingle(),            // read-only statistics accounts (own row only, by RLS)
    ]);
    const isOwner = !!admin?.is_owner;
    return {
      user,
      profile: (profile.data as Profile | null) ?? null,
      isAdmin: !!admin,
      isOwner,
      isReportViewer: !!reportViewer.data,
      role: admin ? (isOwner ? null : isRole(admin.role) ? admin.role : null) : null,
      caps: admin ? capsOf(admin.role, isOwner) : [],
    };
  } catch (e) {
    unstable_rethrow(e); // never swallow Next.js control-flow errors (dynamic rendering, redirects)
    console.error("[auth] viewer lookup failed", (e as Error).message);
    return VISITOR;
  }
});

export async function requireUser(next = "/"): Promise<Viewer & { user: User }> {
  const v = await getViewer();
  if (!v.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v as Viewer & { user: User };
}

const allowed = (v: Viewer, need?: Cap | readonly Cap[]) => !need || (Array.isArray(need) ? need : [need as Cap]).some((c) => can(v.caps, c));

/** Pages: anyone who is not an admin gets a plain 404 (the area is not advertised); so does a staff account whose role does not cover the area (`need` = one capability, or a list where any one is enough). */
export async function requireAdminPage(need?: Cap | readonly Cap[]): Promise<Viewer & { user: User }> {
  const v = await getViewer();
  if (!v.user || !v.isAdmin || !allowed(v, need)) notFound();
  return v as Viewer & { user: User };
}

/** Server actions: first line. Returns the viewer or an error code for the form. */
export async function requireAdminAction(need?: Cap | readonly Cap[]): Promise<{ ok: true; viewer: Viewer & { user: User } } | { ok: false; error: string }> {
  const v = await getViewer();
  if (!v.user) return { ok: false, error: "err_not_signed_in" };
  if (!v.isAdmin || !allowed(v, need)) return { ok: false, error: "err_forbidden" };
  return { ok: true, viewer: v as Viewer & { user: User } };
}

export const displayNameOf = (v: Viewer) =>
  v.profile?.display_name || v.user?.user_metadata?.full_name || v.user?.email?.split("@")[0] || "";
