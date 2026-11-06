import { requireAdminPage } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { loadRevenue } from "@/lib/revenue/service";
import { resolveRange } from "@/lib/revenue/range";
import { REVENUE_CATEGORIES, summarize } from "@/lib/revenue/aggregate";
import { CAT_BG, RevenueChart } from "@/components/RevenueChart";
import { RevenueFilter } from "@/components/RevenueFilter";
import { ExportLink } from "@/components/ExportLink";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
const money = (n: number) => `THB ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdminPage();
  const { t, lang } = await getT();
  const sp = await searchParams;
  const range = resolveRange(sp.range, new Date(), sp.from, sp.to);
  const { paid, refunds, truncated } = await loadRevenue(range);
  const s = summarize(paid, refunds, range);
  const label = (c: string) => (t as unknown as Record<string, string>)[`rev_c_${c}`];
  const when = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" });
  // one row per payment: its lines grouped by category
  const byPay = new Map<string, { at: string; receipt: string | null; ref: string; parts: Map<string, number>; total: number }>();
  for (const l of paid) { const r = byPay.get(l.paymentId) ?? { at: l.at, receipt: l.receiptNo, ref: l.reference, parts: new Map(), total: 0 }; r.parts.set(l.category, (r.parts.get(l.category) ?? 0) + l.amountThb); r.total += l.amountThb; byPay.set(l.paymentId, r); }
  const rows = [...byPay.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
  const q = new URLSearchParams({ range: range.key, ...(range.key === "custom" ? { from: range.fromDate, to: range.toDate } : {}) }).toString();
  const kpi: [string, string, boolean][] = [[t.rev_net, money(s.net), true], [t.rev_gross, money(s.gross), false], [t.rev_refunds, money(s.refunds), false], [t.rev_payments, String(s.payments), false]];
  const top = Math.max(...REVENUE_CATEGORIES.map((c) => s.byCategory[c].net), 1);
  return (
    <div className="space-y-4">
      <PageHead title={t.admin_revenue_title} hint={t.admin_revenue_hint} art="analytics" tone="mint" />
      <RevenueFilter active={range.key} from={range.fromDate} to={range.toDate} />
      <p className="px-1 text-sm text-muted tabular">{t.rev_showing.replace("{from}", range.fromDate).replace("{to}", range.toDate)}</p>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.rev_summary}>
        {kpi.map(([k, v, big]) => <div key={k} className={`rounded-card border p-4 shadow-card ${big ? "border-sky-line bg-sky" : "border-line bg-surface"}`}><p className="text-xs text-muted">{k}</p><p className="font-display text-xl font-extrabold tabular sm:text-2xl">{v}</p></div>)}
      </section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.rev_chart}</h2>
        <RevenueChart series={s.series} bucket={range.bucket} label={t.rev_chart} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{REVENUE_CATEGORIES.map((c) => <li key={c} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${CAT_BG[c]}`} aria-hidden="true" />{label(c)}</li>)}</ul>
      </section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.rev_by_category}</h2>
        <ul className="space-y-3">
          {REVENUE_CATEGORIES.map((c) => { const x = s.byCategory[c]; return (
            <li key={c}>
              <div className="flex items-baseline justify-between gap-2 text-sm"><b>{label(c)}</b><span className="tabular"><b>{money(x.net)}</b>{x.refunds > 0 && <span className="ml-2 text-xs text-muted">({money(x.gross)} − {money(x.refunds)})</span>}</span></div>
              <div className="mt-1 h-2.5 rounded-full bg-sky" aria-hidden="true"><div className={`h-full rounded-full ${CAT_BG[c]}`} style={{ width: `${Math.max(x.net, 0) / top * 100}%` }} /></div>
            </li>); })}
        </ul>
      </section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{t.rev_list}</h2>
          <ExportLink href={`/admin/revenue/export?${q}`}>{t.rev_export}</ExportLink>
        </div>
        {truncated && <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{t.rev_truncated}</p>}
        {rows.length === 0 ? <p className="text-muted">{t.rev_none}</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm tabular">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 pr-3">{t.audit_when}</th><th className="pr-3">{t.rev_receipt}</th><th className="pr-3">{t.rev_ref}</th><th className="pr-3">{t.rev_items}</th><th className="text-right">{t.rev_total}</th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r, i) => (
              <tr key={i}><td className="whitespace-nowrap py-2 pr-3">{when.format(new Date(r.at))}</td><td className="pr-3 font-mono text-xs">{r.receipt ?? ""}</td><td className="pr-3 font-mono text-xs">{r.ref}</td>
                <td className="pr-3"><span className="flex flex-wrap gap-1">{[...r.parts].map(([c, v]) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-xs"><span className={`size-2 rounded-full ${CAT_BG[c as keyof typeof CAT_BG]}`} aria-hidden="true" />{label(c)} {v.toLocaleString("en-US")}</span>)}</span></td>
                <td className="text-right font-bold">{money(r.total)}</td></tr>))}</tbody>
          </table></div>
        )}
        {byPay.size > 100 && <p className="text-xs text-muted">{t.rev_more.replace("{n}", String(byPay.size))}</p>}
      </section>
      <p className="px-1 text-xs text-muted">{t.rev_note}</p>
    </div>
  );
}
