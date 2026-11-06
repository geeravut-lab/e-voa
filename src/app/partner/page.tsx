import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { membersOf, membershipOf, packagesOf, partnerStats } from "@/lib/partner-portal/service";
import { CATEGORIES_OF, periodOf } from "@/lib/partner-portal/rules";
import { addPartnerMemberAction, applyPartnerAction, redeemAction, removePartnerMemberAction, savePackageAction } from "@/app/actions/partner";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";
const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
const money = (n: number) => `THB ${n.toLocaleString("en-US")}`;

export default async function PartnerPage() {
  const v = await requireUser("/partner");
  const { t, lang } = await getT();
  const m = await membershipOf(v.user.id);
  const head = <PageHead title={t.card_partner} hint={t.card_partner_sub} art="extras" tone="mint" />;
  const kindLabel = (k: string) => ({ sim: t.partner_kind_sim, vip: t.partner_kind_vip, bhs: t.partner_kind_bhs, insurance: t.partner_kind_insurance } as Record<string, string>)[k] ?? k;
  const catLabel = (c: string) => ({ sim: t.extras_sim, esim: t.extras_esim, vip: t.extras_vip, health: t.extras_health, insurance: t.extras_insurance } as Record<string, string>)[c] ?? c;
  if (!m) {
    const f = (name: string, label: string, type = "text") => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} type={type} required className={inputCls} /></label>;
    return (
      <div className="space-y-4">{head}
        <section className={box}><h2 className="font-display text-lg font-bold">{t.partner_why}</h2><ul className="list-disc space-y-1 pl-5 text-[15px]">{[t.partner_p1, t.partner_p2, t.partner_p3].map((x) => <li key={x}>{x}</li>)}</ul></section>
        <ActionForm action={applyPartnerAction} className={box}>
          <h2 className="font-display text-lg font-bold">{t.partner_join}</h2>
          {f("name", t.agency_name)}
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_kind}</span><select name="provider" required className={inputCls}>{(["sim", "vip", "bhs", "insurance"] as const).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
          {f("contact_name", t.agency_contact)}{f("contact_email", t.apply_email, "email")}{f("contact_phone", t.apply_phone, "tel")}
          <p className="text-xs text-muted">{t.partner_review}</p><SubmitButton className="w-full">{t.agency_send}</SubmitButton>
        </ActionForm>
      </div>
    );
  }
  const { partner, role } = m;
  if (partner.status !== "active") return <div className="space-y-4">{head}<section className={box}><h2 className="font-display text-lg font-bold">{partner.name}</h2><p role="status" className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{partner.status === "pending" ? t.partner_pending : t.partner_suspended}</p></section></div>;
  const db = createAdminClient();
  const period = periodOf(new Date());
  const [stats, pkgs, members, { data: settled }, { data: waiting }] = await Promise.all([
    partnerStats(partner.id, partner.settlement_pct, period), packagesOf(partner.id), membersOf(partner.id),
    db.from("partner_settlements").select("period, orders, partner_thb, paid_at").eq("partner_id", partner.id).order("period", { ascending: false }).limit(12),
    db.from("addon_orders").select("id, package_name, issued_at").eq("partner_id", partner.id).eq("status", "issued").order("issued_at", { ascending: false }).limit(20),
  ]);
  const cats = CATEGORIES_OF[partner.provider];
  const pkgForm = (p?: (typeof pkgs)[number]) => (
    <ActionForm key={p?.package_code ?? "new"} action={savePackageAction.bind(null, p?.package_code ?? null)} className="space-y-3 rounded-control border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_pkg_cat}</span><select name="category" defaultValue={p?.category ?? cats[0]} className={inputCls}>{cats.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_pkg_name}</span><input name="name" required minLength={2} maxLength={120} defaultValue={p?.name ?? ""} className={inputCls} /></label>
      </div>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_pkg_detail}</span><input name="detail" maxLength={600} defaultValue={p?.detail ?? ""} className={inputCls} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t.partner_pkg_terms}</span><input name="terms" maxLength={600} defaultValue={p?.terms ?? ""} className={inputCls} /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1"><span className="text-sm font-semibold">THB</span><input name="price_thb" type="number" required min={1} max={200000} step={1} defaultValue={p?.price_thb ?? ""} className={`${inputCls} tabular`} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">USD</span><input name="price_usd" type="number" min={0} step="0.01" defaultValue={p?.price_usd ?? ""} className={`${inputCls} tabular`} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">CNY</span><input name="price_cny" type="number" min={0} step="0.01" defaultValue={p?.price_cny ?? ""} className={`${inputCls} tabular`} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={p ? p.active : true} className="size-5" />{t.partner_pkg_active}</label>
      {role === "owner" && <SubmitButton>{p ? t.save : t.partner_pkg_add}</SubmitButton>}
    </ActionForm>
  );
  return (
    <div className="space-y-4">{head}
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{partner.name} <span className="text-sm font-normal text-muted">· {kindLabel(partner.provider)}</span></h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{([[t.partner_stat_waiting, stats.waiting], [t.partner_stat_redeemed, stats.redeemed], [t.partner_stat_gross, money(stats.grossThb)], [t.partner_stat_share, `${money(stats.shareThb)} (${partner.settlement_pct}%)`]] as [string, string | number][]).map(([k, val]) => <div key={k} className="rounded-control bg-sky p-3"><p className="text-xs text-muted">{k}</p><p className="font-display text-lg font-extrabold tabular">{val}</p></div>)}</div>
        <p className="text-xs text-muted">{t.partner_stat_month.replace("{month}", period)}</p>
      </section>
      <ActionForm action={redeemAction} className={box}>
        <h2 className="font-display text-lg font-bold">{t.partner_redeem}</h2>
        <p className="text-sm text-muted">{t.partner_redeem_hint}</p>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t.addon_voucher}</span><input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="TP-XXXXXXXX" className={`${inputCls} font-mono uppercase tracking-widest`} /></label>
        <SubmitButton className="w-full">{t.partner_redeem_btn}</SubmitButton>
      </ActionForm>
      {(waiting ?? []).length > 0 && <section className={box}><h2 className="font-display text-lg font-bold">{t.partner_waiting}</h2><ul className="divide-y divide-line text-sm">{waiting!.map((w) => <li key={w.id} className="flex justify-between gap-2 py-2"><span>{w.package_name}</span><span className="text-xs text-muted tabular">{w.issued_at ? new Intl.DateTimeFormat(lang, { dateStyle: "short" }).format(new Date(w.issued_at)) : ""}</span></li>)}</ul></section>}
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.partner_packages}</h2>
        {!partner.portal_managed && <p className="text-sm text-muted">{t.partner_api_managed}</p>}
        {partner.portal_managed && (<>{pkgs.map((p) => pkgForm(p))}{role === "owner" ? <div className="space-y-2"><h3 className="font-semibold">{t.partner_pkg_new}</h3>{pkgForm()}</div> : <p className="text-xs text-muted">{t.partner_owner_only}</p>}</>)}
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.partner_settlement}</h2>
        <a href={`/partner/settlement.csv?month=${period}`} className={btnClass("ghost")} download>{t.partner_csv.replace("{month}", period)}</a>
        {(settled ?? []).length > 0 && <ul className="divide-y divide-line text-sm">{settled!.map((s) => <li key={s.period} className="flex justify-between gap-2 py-2"><span className="tabular">{s.period} · {s.orders}</span><b className="tabular">{money(Number(s.partner_thb))}</b></li>)}</ul>}
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.agency_team}</h2>
        <ul className="divide-y divide-line">{members.map((x) => <li key={x.user_id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0"><b className="block truncate">{x.name || x.email}</b><span className="text-xs text-muted">{x.email} · {x.role === "owner" ? t.agency_owner : t.partner_staff}</span></span>{role === "owner" && x.role !== "owner" && <ActionForm action={removePartnerMemberAction.bind(null, x.user_id)}><SubmitButton variant="ghost">{t.agency_remove}</SubmitButton></ActionForm>}</li>)}</ul>
        {role === "owner" && <ActionForm action={addPartnerMemberAction} className="space-y-2"><label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_add_email}</span><input name="email" type="email" required className={inputCls} /></label><p className="text-xs text-muted">{t.agency_add_hint}</p><SubmitButton>{t.agency_add}</SubmitButton></ActionForm>}
      </section>
    </div>
  );
}
