import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agencyStats } from "@/lib/agency/service";
import { setAgencyAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AdminAgencies() {
  await requireAdminPage();
  const { t } = await getT();
  const db = createAdminClient();
  const { data: list } = await db.from("agencies").select("id, name, status, contact_name, contact_email, contact_phone, country, license_no, discount_thb, commission_pct, admin_note, created_at").order("created_at", { ascending: false }).limit(100);
  const { data: docs } = (list ?? []).length ? await db.from("documents").select("id, agency_id").in("agency_id", list!.map((a) => a.id)).is("deleted_at", null) : { data: [] };
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const stats = await Promise.all((list ?? []).map((a) => agencyStats(a.id, monthStart)));
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_agencies_title} hint={t.admin_agencies_hint} art="admins" tone="sky" />
      {(list ?? []).length === 0 && <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.ops_none}</p>}
      {(list ?? []).map((a, i) => (
        <ActionForm key={a.id} action={setAgencyAction.bind(null, a.id)} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
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
      ))}
    </div>
  );
}
