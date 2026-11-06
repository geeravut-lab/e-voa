import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { membersOf, membershipOf } from "@/lib/agency/service";
import { addMemberAction, removeMemberAction } from "@/app/actions/agency";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const v = await requireUser("/agency/team");
  const m = await membershipOf(v.user.id); if (!m || m.agency.status !== "active") notFound();
  const { t } = await getT();
  const members = await membersOf(m.agency.id);
  return (
    <div className="space-y-4">
      <PageHead title={t.agency_team} hint={m.agency.name} art="travelers" tone="sand" />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <ul className="divide-y divide-line">{members.map((x) => <li key={x.user_id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0"><b className="block truncate">{x.name || x.email}</b><span className="text-xs text-muted">{x.email} · {x.role === "owner" ? t.agency_owner : t.agency_agent}</span></span>
          {m.role === "owner" && x.role !== "owner" && <ActionForm action={removeMemberAction.bind(null, x.user_id)}><SubmitButton variant="ghost">{t.agency_remove}</SubmitButton></ActionForm>}</li>)}</ul>
      </section>
      {m.role === "owner" && <ActionForm action={addMemberAction} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card"><label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_add_email}</span><input name="email" type="email" required className={inputCls} /></label><p className="text-xs text-muted">{t.agency_add_hint}</p><SubmitButton>{t.agency_add}</SubmitButton></ActionForm>}
    </div>
  );
}
