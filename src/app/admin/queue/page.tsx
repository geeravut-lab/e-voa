import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NavRowLink, AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { StatusBadge, statusLabel } from "@/components/StatusBadge";
import { btnClass } from "@/components/buttonStyles";
import { QueueFilterBar, SaveFilterForm, DeleteFilterForm, BulkBar, BULK_FORM } from "@/components/QueueTools";
import { GROUPS, SLA_OPEN, filterQuery, parseFilter } from "@/lib/ops/filters";
import { listAssignees, loadSavedFilters } from "@/lib/ops/service";

export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdminPage(["ops", "finance"]);
  const canWork = viewer.caps.includes("ops");                                     // finance-only staff can look, not assign
  const { t, lang } = await getT();
  const raw = await searchParams;
  const f = parseFilter(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const g = f.g;
  const { data: sum } = await (await createClient()).rpc("admin_ops_summary");
  const s = (sum ?? {}) as { by_status?: Record<string, number>; sla_overdue?: number; sla_at_risk?: number; addons_failed?: number; revenue_thb_today?: number };
  const db = createAdminClient();
  const now = Date.now();
  const build = (cols: string) => {
    let q = db.from("applications").select(cols).order("sla_due_at", { ascending: true, nullsFirst: false }).limit(100);
    if (g !== "all") q = q.in("status", GROUPS[g]);
    if (f.q) q = q.ilike("ref_no", `%${f.q.toUpperCase().replace(/[%_,()]/g, "")}%`);
    if (f.p !== "any") q = q.eq("package", f.p);
    if (f.late) q = q.in("status", SLA_OPEN).lt("sla_due_at", new Date(now).toISOString());
    return q;
  };
  type Row = { id: string; ref_no: string; status: string; package: string; sla_due_at: string | null; traveler_id: string; assigned_to?: string | null };
  const withAssign = (() => { let q = build("id, ref_no, status, package, sla_due_at, traveler_id, assigned_to"); if (f.a === "me") q = q.eq("assigned_to", viewer.user.id); else if (f.a === "none") q = q.is("assigned_to", null); else if (f.a !== "any") q = q.eq("assigned_to", f.a); return q; })();
  let { data: apps, error: listErr } = (await withAssign) as unknown as { data: Row[] | null; error: unknown };
  if (listErr) apps = ((await build("id, ref_no, status, package, sla_due_at, traveler_id")) as unknown as { data: Row[] | null }).data;       // assignment columns not there yet: the queue still works
  const [people, saved] = await Promise.all([listAssignees(), loadSavedFilters(viewer.user.id)]);
  const who = new Map(people.map((p) => [p.id, p.label]));
  const ids = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const { data: trs } = ids.length ? await db.from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
  const count = (k: string) => GROUPS[k].reduce((n, st) => n + (s.by_status?.[st] ?? 0), 0);
  const tabs = [["attention", t.ops_g_attention], ["active", t.ops_g_active], ["unpaid", t.ops_g_unpaid], ["decided", t.ops_g_decided], ["all", t.ops_g_all]] as const;
  const fmtDate = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });
  const tabHref = (k: string) => `/admin/queue?${filterQuery({ ...f, g: k })}`;
  return (
    <div className="space-y-4">
      <PageHead title={t.card_ops} hint={t.card_ops_sub} art="ops" tone="gold" />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.ops_summary}>
        {[[t.ops_sla_overdue, s.sla_overdue ?? 0, (s.sla_overdue ?? 0) > 0], [t.ops_sla_risk, s.sla_at_risk ?? 0, false], [t.ops_addons_failed, s.addons_failed ?? 0, (s.addons_failed ?? 0) > 0], [t.ops_revenue_today, `THB ${Number(s.revenue_thb_today ?? 0).toLocaleString("en-US")}`, false]].map(([l, n, bad]) => (
          <div key={String(l)} className={`rounded-card border p-4 shadow-card ${bad ? "border-danger bg-rose" : "border-line bg-surface"}`}><p className="text-xs text-muted">{l}</p><p className="font-display text-2xl font-extrabold tabular">{n}</p></div>
        ))}
      </section>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t.ops_summary}>
        {tabs.map(([k, label]) => <AppLink key={k} href={tabHref(k)} className={btnClass(g === k ? "primary" : "ghost", "min-h-10 shrink-0 px-4")}>{label}{k !== "all" && ` · ${count(k)}`}</AppLink>)}
      </nav>
      <QueueFilterBar key={filterQuery(f)} value={f} people={people} />
      {canWork && (
        <section className="space-y-2 rounded-card border border-line bg-surface p-4 shadow-card" aria-label={t.ops_saved}>
          <h2 className="font-display text-base font-bold">{t.ops_saved}</h2>
          {saved.length > 0 && <ul className="flex flex-wrap gap-2">{saved.map((x) => (
            <li key={x.id} className="flex items-center gap-1 rounded-full border border-line bg-sand ps-3">
              <AppLink href={`/admin/queue?${filterQuery(x.filter)}`} className="min-h-9 text-sm font-semibold text-primary">{x.name}</AppLink>
              <DeleteFilterForm id={x.id} name={x.name} />
            </li>))}</ul>}
          <SaveFilterForm filter={f} />
        </section>
      )}
      <ul className="space-y-2">
        {(apps ?? []).map((a) => {
          const tr = trs?.find((x) => x.id === a.traveler_id);
          const late = a.sla_due_at && Date.parse(a.sla_due_at) < now && SLA_OPEN.includes(a.status);
          const name = tr ? `${tr.given_name} ${tr.surname}` : a.ref_no;
          return (
            <li key={a.id} className="flex items-stretch gap-2">
              {canWork && <label className="grid w-11 shrink-0 place-items-center"><input type="checkbox" name="ids" value={a.id} form={BULK_FORM} className="h-5 w-5" aria-label={`${t.ops_select_row}: ${name}`} /></label>}
              <NavRowLink href={`/admin/queue/${a.id}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded-card border p-4 shadow-card ${late ? "border-danger bg-rose" : "border-line bg-surface"}`}>
                <span className="min-w-0 flex-1"><b className="block truncate">{name}</b>
                  <span className="block text-xs text-muted tabular">{a.ref_no} · {a.package === "express" ? t.apply_pkg_express : t.apply_pkg_regular}{a.sla_due_at ? ` · ${t.ops_due} ${fmtDate.format(new Date(a.sla_due_at))}` : ""}</span>
                  {a.assigned_to && <span className="block text-xs font-semibold text-teal-deep">{t.ops_assigned_to} {who.get(a.assigned_to) ?? "…"}</span>}</span>
                {late && <span className="text-xs font-extrabold text-danger">{t.ops_late}</span>}
                <StatusBadge status={a.status} t={t} />
              </NavRowLink>
            </li>
          );
        })}
        {(apps ?? []).length === 0 && <li className="rounded-card border border-line bg-surface p-5 text-center text-muted">{t.ops_empty} ({statusLabel(t, GROUPS[g]?.[0] ?? "")})</li>}
      </ul>
      {canWork && (apps ?? []).length > 0 && <BulkBar people={people} />}
    </div>
  );
}
