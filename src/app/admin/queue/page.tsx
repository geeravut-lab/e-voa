import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NavRowLink, AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { StatusBadge, statusLabel } from "@/components/StatusBadge";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
const GROUPS: Record<string, string[]> = {
  attention: ["action_required", "submission_failed"],
  active: ["paid", "pre_check", "submitted", "under_review"],
  unpaid: ["draft", "awaiting_payment"],
  decided: ["approved", "rejected", "used", "no_show", "cancelled", "expired"],
};

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ g?: string; q?: string }> }) {
  await requireAdminPage();
  const { t, lang } = await getT();
  const sp = await searchParams; const g = sp.g && GROUPS[sp.g] ? sp.g : sp.g === "all" ? "all" : "active";
  const { data: sum } = await (await createClient()).rpc("admin_ops_summary");
  const s = (sum ?? {}) as { by_status?: Record<string, number>; sla_overdue?: number; sla_at_risk?: number; addons_failed?: number; revenue_thb_today?: number };
  const db = createAdminClient();
  let q = db.from("applications").select("id, ref_no, status, package, sla_due_at, created_at, traveler_id, trip_id").order("sla_due_at", { ascending: true, nullsFirst: false }).limit(100);
  if (g !== "all") q = q.in("status", GROUPS[g]);
  const ref = (sp.q ?? "").trim().toUpperCase();
  if (ref) q = q.ilike("ref_no", `%${ref.replace(/[%_]/g, "")}%`);
  const { data: apps } = await q;
  const ids = [...new Set((apps ?? []).map((a) => a.traveler_id))];
  const { data: trs } = ids.length ? await db.from("travelers").select("id, given_name, surname").in("id", ids) : { data: [] };
  const count = (k: string) => GROUPS[k].reduce((n, st) => n + (s.by_status?.[st] ?? 0), 0);
  const tabs = [["attention", t.ops_g_attention], ["active", t.ops_g_active], ["unpaid", t.ops_g_unpaid], ["decided", t.ops_g_decided], ["all", t.ops_g_all]] as const;
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });
  const now = Date.now();
  return (
    <div className="space-y-4">
      <PageHead title={t.card_ops} hint={t.card_ops_sub} art="ops" tone="gold" />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.ops_summary}>
        {[[t.ops_sla_overdue, s.sla_overdue ?? 0, (s.sla_overdue ?? 0) > 0], [t.ops_sla_risk, s.sla_at_risk ?? 0, false], [t.ops_addons_failed, s.addons_failed ?? 0, (s.addons_failed ?? 0) > 0], [t.ops_revenue_today, `THB ${Number(s.revenue_thb_today ?? 0).toLocaleString("en-US")}`, false]].map(([l, n, bad]) => (
          <div key={String(l)} className={`rounded-card border p-4 shadow-card ${bad ? "border-danger bg-rose" : "border-line bg-surface"}`}><p className="text-xs text-muted">{l}</p><p className="font-display text-2xl font-extrabold tabular">{n}</p></div>
        ))}
      </section>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t.ops_summary}>
        {tabs.map(([k, label]) => <AppLink key={k} href={`/admin/queue?g=${k}`} className={btnClass(g === k ? "primary" : "ghost", "min-h-10 shrink-0 px-4")}>{label}{k !== "all" && ` · ${count(k)}`}</AppLink>)}
      </nav>
      <ul className="space-y-2">
        {(apps ?? []).map((a) => {
          const tr = trs?.find((x) => x.id === a.traveler_id);
          const late = a.sla_due_at && Date.parse(a.sla_due_at) < now && GROUPS.active.concat(GROUPS.attention).includes(a.status);
          return (
            <li key={a.id}><NavRowLink href={`/admin/queue/${a.id}`} className={`flex items-center gap-3 rounded-card border p-4 shadow-card ${late ? "border-danger bg-rose" : "border-line bg-surface"}`}>
              <span className="min-w-0 flex-1"><b className="block truncate">{tr ? `${tr.given_name} ${tr.surname}` : a.ref_no}</b>
                <span className="block text-xs text-muted tabular">{a.ref_no} · {a.package === "express" ? t.apply_pkg_express : t.apply_pkg_regular}{a.sla_due_at ? ` · ${t.ops_due} ${fmt.format(new Date(a.sla_due_at))}` : ""}</span></span>
              {late && <span className="text-xs font-extrabold text-danger">{t.ops_late}</span>}
              <StatusBadge status={a.status} t={t} />
            </NavRowLink></li>
          );
        })}
        {(apps ?? []).length === 0 && <li className="rounded-card border border-line bg-surface p-5 text-center text-muted">{t.ops_empty} ({statusLabel(t, GROUPS[g]?.[0] ?? "")})</li>}
      </ul>
    </div>
  );
}
