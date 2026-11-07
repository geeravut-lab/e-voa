import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { thaiDayRange, yesterdayThai, type Issue } from "@/lib/reconcile/rules";
import { reviewReconcileAction, runReconcileAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { ExportLink } from "@/components/ExportLink";
import { PageHead } from "@/components/PageHead";
import { SubmitButton } from "@/components/Buttons";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";
const money = (n: number) => `THB ${n.toLocaleString("en-US")}`;

export default async function ReconcilePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdminPage("finance");
  const { t } = await getT();
  const asked = (await searchParams).date, day = asked && thaiDayRange(asked) ? asked : yesterdayThai();
  const tt = t as unknown as Record<string, string>;
  const db = createAdminClient();
  const [{ data: row }, { data: recent }] = await Promise.all([
    db.from("reconciliation_reports").select("*").eq("day", day).maybeSingle(),
    db.from("reconciliation_reports").select("day, status, reviewed_at, issues").order("day", { ascending: false }).limit(14),
  ]);
  const issues = (Array.isArray(row?.issues) ? row!.issues : []) as Issue[];
  const tone = (s: string) => (s === "ok" ? "bg-mint text-teal-deep" : s === "issues" ? "bg-gold-soft text-gold-deep" : "bg-line text-muted");
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_reconcile_title} hint={t.admin_reconcile_hint} art="reconcile" tone="mint" />
      <form action="/admin/reconcile" className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <label className="space-y-1"><span className="block text-xs font-semibold text-muted">{t.recon_day}</span><input type="date" name="date" defaultValue={day} max={yesterdayThai()} className={`${inputCls} w-auto`} /></label>
        <button type="submit" className={btnClass("primary", "min-h-11 px-5")}>{t.recon_show}</button>
      </form>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tabular">{day} {row && <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-bold ${tone(row.status)}`}>{tt[`recon_status_${row.status}`]}</span>}</h2>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={runReconcileAction.bind(null, day)} className=""><SubmitButton variant="ghost">{t.recon_run}</SubmitButton></ActionForm>
            {row && <ExportLink href={`/admin/reconcile/export?date=${day}`} variant="ghost">{t.rev_export}</ExportLink>}
          </div>
        </div>
        {!row ? <p className="text-muted">{t.recon_none}</p> : row.status === "error" || row.status === "skipped" ? <p className="text-sm text-gold-deep">{row.error}</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([[t.recon_stripe, money(row.stripe_gross_thb), `${row.stripe_count} ${t.recon_payments}`], [t.recon_ours, money(row.ours_gross_thb), `${row.ours_count} ${t.recon_payments}`], [t.recon_diff, money(row.stripe_gross_thb - row.ours_gross_thb), ""], [t.recon_refunds, `${money(row.stripe_refunds_thb)} / ${money(row.ours_refunds_thb)}`, ""]] as const).map(([k, v, sub]) => (
                <div key={k} className="rounded-card border border-line p-3"><p className="text-xs text-muted">{k}</p><p className="font-display text-lg font-extrabold tabular">{v}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
              ))}
            </div>
            {issues.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">{t.recon_issues} ({issues.length})</h3>
                <ul className="divide-y divide-line rounded-control border border-line text-sm">
                  {issues.map((x, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="min-w-0"><b className="block">{tt[`recon_issue_${x.kind}`]}</b><span className="break-all font-mono text-xs text-muted">{t.recon_reference}: {x.ref}</span></span>
                      <span className="tabular text-end text-xs">Stripe {x.stripeThb === null ? "–" : money(x.stripeThb)}<br />{t.recon_ours} {x.oursThb === null ? "–" : money(x.oursThb)}</span>
                    </li>
                  ))}
                </ul>
                {row.reviewed_at ? <p className="text-sm font-semibold text-success">✓ {t.recon_reviewed}</p> : <ActionForm action={reviewReconcileAction.bind(null, day)} className=""><SubmitButton>{t.recon_review}</SubmitButton></ActionForm>}
              </div>
            )}
          </>
        )}
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.recon_recent}</h2>
        <ul className="flex flex-wrap gap-2">
          {(recent ?? []).map((r) => <li key={r.day}><AppLink href={`/admin/reconcile?date=${r.day}`} className={btnClass("ghost", "min-h-9 px-3 text-sm tabular")}>{r.day} <span className={`ms-1 rounded-full px-1.5 text-xs font-bold ${tone(r.status)}`}>{r.status === "issues" ? `${(r.issues as unknown[]).length}${r.reviewed_at ? " ✓" : ""}` : r.status}</span></AppLink></li>)}
        </ul>
        <p className="text-xs text-muted">{t.recon_note}</p>
      </section>
    </div>
  );
}
