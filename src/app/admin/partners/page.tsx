import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { partnerStats, settlementLines } from "@/lib/partner-portal/service";
import { periodOf } from "@/lib/partner-portal/rules";
import { setPartnerAction, settlePartnerAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";
const money = (n: number) => `THB ${n.toLocaleString("en-US")}`;

export default async function AdminPartners() {
  await requireAdminPage();
  const { t } = await getT();
  const db = createAdminClient();
  const { data: list } = await db.from("partners").select("id, name, provider, status, portal_managed, settlement_pct, contact_name, contact_email, contact_phone, admin_note").order("created_at", { ascending: false }).limit(100);
  const now = new Date(), prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periods = [periodOf(prev), periodOf(now)];
  const data = await Promise.all((list ?? []).map(async (p) => ({
    stats: await partnerStats(p.id, Number(p.settlement_pct), periodOf(now)),
    open: await Promise.all(periods.map(async (per) => { const l = await settlementLines(p.id, per, Number(p.settlement_pct)); return { period: per, orders: l.length, share: Math.round(l.reduce((s, x) => s + x.shareThb, 0) * 100) / 100 }; })),
  })));
  const kind = (k: string) => ({ sim: t.partner_kind_sim, vip: t.partner_kind_vip, bhs: t.partner_kind_bhs, insurance: t.partner_kind_insurance } as Record<string, string>)[k] ?? k;
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_partners_title} hint={t.admin_partners_hint} art="admins" tone="sky" />
      {(list ?? []).length === 0 && <p className="rounded-card border border-line bg-surface p-5 text-muted">{t.ops_none}</p>}
      {(list ?? []).map((p, i) => (
        <section key={p.id} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
          <ActionForm action={setPartnerAction.bind(null, p.id)} className="space-y-3">
            <h2 className="font-display text-lg font-bold">{p.name} <span className="text-sm font-normal text-muted">· {kind(p.provider)}</span></h2>
            <p className="text-sm text-muted">{[p.contact_name, p.contact_email, p.contact_phone].filter(Boolean).join(" · ")}</p>
            <p className="text-xs tabular">{t.partner_stat_waiting}: {data[i].stats.waiting} · {t.partner_stat_redeemed}: {data[i].stats.redeemed} · {t.partner_stat_gross}: {money(data[i].stats.grossThb)}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_status}</span><select name="status" defaultValue={p.status} className={inputCls}><option value="pending">{t.agency_s_pending}</option><option value="active">{t.agency_s_active}</option><option value="suspended">{t.agency_s_suspended}</option></select></label>
              <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_pct}</span><input name="settlement_pct" type="number" min={0} max={100} step="0.5" defaultValue={Number(p.settlement_pct)} className={`${inputCls} tabular`} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="portal_managed" defaultChecked={p.portal_managed} className="size-5" />{t.partner_portal_managed}</label>
            <label className="block space-y-1"><span className="text-sm font-semibold">{t.ops_notes}</span><input name="admin_note" defaultValue={p.admin_note ?? ""} maxLength={500} className={inputCls} /></label>
            <SubmitButton>{t.save}</SubmitButton>
          </ActionForm>
          <div className="space-y-2 border-t border-line pt-3">
            <h3 className="font-semibold">{t.partner_settle_title}</h3>
            {data[i].open.map((o) => (
              <ActionForm key={o.period} action={settlePartnerAction.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="period" value={o.period} />
                <span className="min-w-[10rem] text-sm tabular"><b>{o.period}</b> · {o.orders} · {money(o.share)}</span>
                <input name="note" placeholder={t.partner_settle_note} maxLength={300} className={`${inputCls} min-w-[8rem] flex-1`} />
                {o.orders > 0 && <SubmitButton variant="ghost">{t.partner_settle_btn}</SubmitButton>}
              </ActionForm>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
