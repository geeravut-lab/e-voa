import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { resolveRange } from "@/lib/revenue/range";
import { listViewers, loadReport } from "@/lib/tourism/service";
import { grantReportViewerAction, revokeReportViewerAction } from "@/app/actions/admin";
import { TourismReport } from "@/components/TourismReport";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminTourism({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdminPage("audit");
  const { t } = await getT();
  const sp = await searchParams;
  const range = resolveRange(sp.range, new Date(), sp.from, sp.to);
  const [report, viewers] = await Promise.all([loadReport(range, t), listViewers()]);
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_tourism_title} hint={t.admin_tourism_hint} art="analytics" tone="sky" />
      <TourismReport r={report} t={t} base="/admin/tourism" range={range.key} />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <div><h2 className="font-display text-lg font-bold">{t.gov_viewers}</h2><p className="text-xs text-muted">{t.gov_viewers_hint}</p></div>
        <ActionForm action={grantReportViewerAction} className="space-y-2">
          <input type="email" name="email" required placeholder={t.admins_email} aria-label={t.admins_email} className={inputCls} />
          <SubmitButton>{t.gov_grant}</SubmitButton>
        </ActionForm>
        {viewers.length === 0 ? <p className="text-sm text-muted">{t.gov_none}</p> : (
          <ul className="divide-y divide-line">
            {viewers.map((v) => (
              <li key={v.user_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{v.email ?? v.user_id}</span>
                <ActionForm action={revokeReportViewerAction.bind(null, v.user_id)} className=""><SubmitButton variant="ghost">{t.gov_revoke}</SubmitButton></ActionForm>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t.gov_link}</p>
      </section>
    </div>
  );
}
