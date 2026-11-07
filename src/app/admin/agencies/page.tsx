import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agencyStats, loadStatement, payoutsOf } from "@/lib/agency/service";
import { periodOf } from "@/lib/partner-portal/rules";
import { payAgencyCommissionAction } from "@/app/actions/admin";
import { ExportLink } from "@/components/ExportLink";
import { setAgencyAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminAgencies() {
  await requireAdminPage("finance");
  const { t } = await getT();
  const db = createAdminClient();
  const { data: list } = await db.from("agencies").select("id, name, status, contact_name, contact_email, contact_phone, country, license_no, discount_thb, commission_pct, admin_note, created_at").order("created_at", { ascending: false }).limit(100);
  const { data: docs } = (list ?? []).length ? await db.from("documents").select("id, agency_id").in("agency_id", list!.map((a) => a.id)).is("deleted_at", null) : { data: [] };
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const stats = await Promise.all((list ?? []).map((a) => agencyStats(a.id, monthStart)));
  const now = new Date(), months = [periodOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))), periodOf(now)];
  const pay = await Promise.all((list ?? []).filter((a) => a.status === "active").map(async (a) => ({ id: a.id, payouts: await payoutsOf(a.id), statements: await Promise.all(months.map((m) => loadStatement(a.id, m))) })));
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_agencies_title} hint={t.admin_agencies_hint} art="admins" tone="sky" />
      {(list ?? []).length === 0 && <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.ops_none}</p>}
      {(list ?? []).map((a, i) => (
        <div key={a.id} className="space-y-2">
        <ActionForm action={setAgencyAction.bind(null, a.id)} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-bold">{a.name}</h2>
          <p className="text-sm text-muted">{[a.contact_name, a.contact_email, a.contact_phone, a.country, a.license_no].filter(Boolean).join(" · ")}</p>
          <p className="text-xs tabular">{t.agency_stat_apps}: {stats[i].applications} · {t.agency_stat_paid}: {stats[i].paid} · {t.agency_stat_commission}: THB {stats[i].commissionThb.toLocaleString("en-US")}</p>
          {(docs ?? []).filter((d) => d.agency_id === a.id).map((d) => <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="block text-sm font-semibold text-primary underline">{t.agency_doc}</a>)}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_status}</span><select name="status" defaultValue={a.status} className={inputCls}><option value="pending">{t.agency_s_pending}</option><option value="active">{t.agency_s_active}</option><option value="suspended">{t.agency_s_suspended}</option></select></label>
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_discount}</span><input name="discount_thb" type="number" min={0} max={600} defaultValue={a.discount_thb} className={`${inputCls} tabular`} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_commission}</span><input name="commission_pct" type="number" min={0} max={50} step="0.5" defaultValue={Number(a.commission_pct)} className={`${inputCls} tabular`} /></label>
          </div>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.ops_notes}</span><input name="admin_note" defaultValue={a.admin_note ?? ""} maxLength={500} className={inputCls} /></label>
          <SubmitButton>{t.save}</SubmitButton>
        </ActionForm>
        {a.status === "active" && (() => { const x = pay.find((p) => p.id === a.id)!; return (
          <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
            <h3 className="font-semibold">{t.agency_statements}</h3>
            {months.map((m, k) => { const st = x.statements[k]; const paid = x.payouts.find((p) => p.period === m); return (
              <ActionForm key={m} action={payAgencyCommissionAction.bind(null, a.id)} className="flex flex-wrap items-end gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                <input type="hidden" name="period" value={m} />
                <span className="min-w-[11rem] text-sm tabular"><b>{m}</b> · {st && st.applications > 0 ? `${t.agency_st_apps.replace("{n}", String(st.applications))} · THB ${st.commissionThb.toLocaleString("en-US")}` : t.agency_st_none}{paid && <span className="block text-xs font-semibold text-success">{t.agency_st_paid.replace("{date}", paid.paid_at.slice(0, 10))}</span>}</span>
                {st && st.applications > 0 && <><ExportLink variant="ghost" href={`/agency/statement?agency=${a.id}&month=${m}&format=pdf`}>{t.agency_dl_pdf}</ExportLink><ExportLink variant="ghost" href={`/agency/statement?agency=${a.id}&month=${m}&format=csv`}>{t.agency_dl_csv}</ExportLink></>}
                {st && st.commissionThb > 0 && !paid && <><input name="note" placeholder={t.agency_pay_note} maxLength={300} className={`${inputCls} min-w-[8rem] flex-1`} /><SubmitButton variant="ghost">{t.agency_pay_btn}</SubmitButton></>}
              </ActionForm>); })}
          </section>); })()}
        </div>
      ))}
    </div>
  );
}
