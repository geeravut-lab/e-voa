import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agencyStats, membershipOf } from "@/lib/agency/service";
import { applyAgencyAction } from "@/app/actions/agency";
import { ActionForm } from "@/components/ActionForm";
import { AppLink } from "@/components/AppLink";
import { SubmitButton } from "@/components/Buttons";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { btnClass } from "@/components/buttonStyles";
import { inputCls } from "@/components/inputStyles";

export const dynamic = "force-dynamic";

export default async function AgencyPage() {
  const v = await requireUser("/agency");
  const { t, lang } = await getT();
  const m = await membershipOf(v.user.id);
  const head = <PageHead title={t.card_agency} hint={t.card_agency_sub} art="travelers" tone="sand" />;
  const box = "space-y-3 rounded-card border border-line bg-surface p-5 shadow-card";
  if (!m) {
    const f = (name: string, label: string, type = "text", req = true) => <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span><input name={name} type={type} required={req} className={inputCls} /></label>;
    return (
      <div className="space-y-4">{head}
        <section className={box}><h2 className="font-display text-lg font-bold">{t.agency_why}</h2><ul className="list-disc space-y-1 pl-5 text-[15px]">{[t.agency_p1, t.agency_p2, t.agency_p3].map((x) => <li key={x}>{x}</li>)}</ul></section>
        <ActionForm action={applyAgencyAction} className={box}>
          <h2 className="font-display text-lg font-bold">{t.agency_join}</h2>
          {f("name", t.agency_name)}{f("contact_name", t.agency_contact)}{f("contact_email", t.apply_email, "email")}{f("contact_phone", t.apply_phone, "tel")}{f("country", t.agency_country)}{f("license_no", t.agency_license, "text", false)}
          <label className="block space-y-1"><span className="text-sm font-semibold">{t.agency_doc}</span><input name="doc" type="file" accept="image/jpeg,image/png,application/pdf" className="block w-full min-w-0 text-sm" /></label>
          <p className="text-xs text-muted">{t.agency_review}</p><SubmitButton className="w-full">{t.agency_send}</SubmitButton>
        </ActionForm>
      </div>
    );
  }
  const { agency } = m;
  if (agency.status !== "active") return <div className="space-y-4">{head}<section className={box}><h2 className="font-display text-lg font-bold">{agency.name}</h2><p role="status" className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{agency.status === "pending" ? t.agency_pending : t.agency_suspended}</p></section></div>;
  const db = createAdminClient();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [stats, { data: apps }] = await Promise.all([agencyStats(agency.id, monthStart), db.from("applications").select("id, ref_no, status, package, owner_id, traveler_id, created_at").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(50)]);
  const ids = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const { data: trs } = ids.length ? await db.from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
  const money = (n: number) => `THB ${n.toLocaleString("en-US")}`;
  return (
    <div className="space-y-4">{head}
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{agency.name}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{([[t.agency_stat_apps, stats.applications], [t.agency_stat_paid, stats.paid], [t.agency_stat_approved, stats.approved], [t.agency_stat_commission, `${money(stats.commissionThb)} (${stats.commissionPct}%)`]] as [string, string | number][]).map(([k, val]) => <div key={k} className="rounded-control bg-sky p-3"><p className="text-xs text-muted">{k}</p><p className="font-display text-lg font-extrabold tabular">{val}</p></div>)}</div>
        <p className="text-xs text-muted">{t.agency_terms.replace("{discount}", money(agency.discount_thb))}</p>
        <div className="grid gap-2 sm:grid-cols-3"><AppLink href={`/apply?agency=${agency.id}`} className={btnClass("gold")}>{t.agency_new}</AppLink><AppLink href="/agency/import" className={btnClass("ghost")}>{t.agency_import}</AppLink><AppLink href="/agency/team" className={btnClass("ghost")}>{t.agency_team}</AppLink></div>
      </section>
      <section className={box}>
        <h2 className="font-display text-lg font-bold">{t.agency_apps}</h2>
        {(apps ?? []).length === 0 ? <p className="text-sm text-muted">{t.agency_none}</p> : <ul className="divide-y divide-line">{apps!.map((a) => { const tr = trs?.find((x) => x.id === a.traveler_id); const own = a.owner_id === v.user.id;
          return <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0"><b className="block truncate">{tr ? `${tr.given_name} ${tr.surname}` : a.ref_no}</b><span className="text-xs text-muted tabular">{a.ref_no} · {new Intl.DateTimeFormat(lang, { dateStyle: "short" }).format(new Date(a.created_at))}{own ? "" : ` · ${t.agency_by_colleague}`}</span></span>{own ? <AppLink href={a.status === "draft" ? "/trips" : `/trips/${a.id}`} className="shrink-0"><StatusBadge status={a.status} t={t} /></AppLink> : <StatusBadge status={a.status} t={t} />}</li>; })}</ul>}
      </section>
    </div>
  );
}
