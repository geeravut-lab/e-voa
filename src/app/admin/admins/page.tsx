import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { grantAdminAction, revokeAdminAction, setAdminRoleAction } from "@/app/actions/admin";
import { ROLES, isRole } from "@/lib/roles";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const viewer = await requireAdminPage("staff");
  const { t } = await getT();
  let rows: { user_id: string; is_owner: boolean; role: string | null; email: string | null }[] = [];
  if (hasServiceRole()) {
    const db = createAdminClient();
    const { data: admins } = await db.from("admins").select("user_id, is_owner, role").order("created_at");
    const ids = (admins ?? []).map((a) => a.user_id);
    const { data: profiles } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] as { id: string; email: string | null }[] };
    const email = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    rows = (admins ?? []).map((a) => ({ ...a, email: email.get(a.user_id) ?? null }));
  }
  const dict = t as unknown as Record<string, string>;
  const label = (r: string) => dict[`admins_role_${r}`] ?? r, hint = (r: string) => dict[`admins_role_${r}_hint`] ?? "";
  return (
    <div className="space-y-4">
      <PageHead title={t.admins_title} art="admins" tone="sky" />
      <p className="text-sm text-muted">{t.admins_roles_note}</p>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.admins_grant}</h2>
        <ActionForm action={grantAdminAction} className="space-y-2">
          <input type="email" name="email" required placeholder={t.admins_email} aria-label={t.admins_email} className="min-h-11 w-full rounded-control border-[1.5px] border-field bg-surface px-3" />
          <label className="block text-sm font-semibold">{t.admins_role}
            <select name="role" defaultValue="manager" className="mt-1 min-h-11 w-full rounded-control border-[1.5px] border-field bg-surface px-3 font-normal">
              {ROLES.map((r) => <option key={r} value={r}>{label(r)} — {hint(r)}</option>)}
            </select>
          </label>
          <SubmitButton>{t.admins_grant}</SubmitButton>
        </ActionForm>
      </section>
      {rows.length === 0 ? (
        <p className="text-muted">{t.admins_empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {rows.map((r) => {
            const me = r.user_id === viewer.user.id;
            return (
              <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.email ?? r.user_id}</p>
                  <p className="flex gap-2 text-xs font-bold">
                    {r.is_owner && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-gold-deep">{t.admins_owner}</span>}
                    {!r.is_owner && <span className="rounded-full bg-mint px-2 py-0.5 text-teal-deep">{label(isRole(r.role) ? r.role : "manager")}</span>}
                    {me && <span className="rounded-full bg-sky px-2 py-0.5 text-primary">{t.admins_you}</span>}
                  </p>
                </div>
                {!r.is_owner && viewer.isOwner && (
                  <ActionForm action={setAdminRoleAction.bind(null, r.user_id)} className="flex items-center gap-2">
                    <select name="role" defaultValue={isRole(r.role) ? r.role : "manager"} aria-label={t.admins_role} className="min-h-11 rounded-control border-[1.5px] border-field bg-surface px-3">
                      {ROLES.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                    </select>
                    <SubmitButton variant="ghost">{t.admins_role_save}</SubmitButton>
                  </ActionForm>
                )}
                {/* The remove button is not drawn for yourself or the owner; the server action and the database refuse as well. */}
                {!me && !r.is_owner && (
                  <ActionForm action={revokeAdminAction.bind(null, r.user_id)}>
                    <SubmitButton variant="danger">{t.admins_revoke}</SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
