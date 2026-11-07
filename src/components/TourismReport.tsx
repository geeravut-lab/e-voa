import type { Dict } from "@/lib/i18n/dict/en";
import { MIN_CELL, SECTIONS, type Report } from "@/lib/tourism/stats";
import { SECTION_KEYS } from "@/lib/tourism/service";
import { RevenueFilter } from "./RevenueFilter";
import { ExportLink } from "./ExportLink";

/** The statistics themselves, shared by the staff page and the read-only page. Counts only: nothing here identifies a person. */
export function TourismReport({ r, t, base, range }: { r: Report; t: Dict; base: string; range: string }) {
  const tt = t as unknown as Record<string, string>;
  const q = new URLSearchParams({ range, ...(range === "custom" ? { from: r.from, to: r.to } : {}) }).toString();
  const max = Math.max(1, ...r.daily.map((d) => d.n));
  const kpi: [string, string][] = [[t.tourism_arrivals, r.arrivals.toLocaleString("en-US")], [t.tourism_received, r.received.toLocaleString("en-US")], [t.tourism_rate, r.approvalRate === null ? "–" : `${r.approvalRate}%`],
    [t.tourism_decision, r.avgDecisionHours === null ? "–" : `${r.avgDecisionHours} ${t.tourism_hours}`], [t.tourism_lead, r.avgLeadDays === null ? "–" : `${r.avgLeadDays} ${t.tourism_days}`]];
  return (
    <div className="space-y-4">
      <RevenueFilter active={range} from={r.from} to={r.to} base={base} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted tabular">{t.tourism_showing.replace("{from}", r.from).replace("{to}", r.to)}</p>
        <ExportLink href={`${base}/export?${q}`}>{t.rev_export}</ExportLink>
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label={t.tourism_summary}>
        {kpi.map(([k, v], i) => <div key={k} className={`rounded-card border p-4 shadow-card ${i === 0 ? "border-sky-line bg-sky" : "border-line bg-surface"}`}><p className="text-xs text-muted">{k}</p><p className="font-display text-2xl font-extrabold tabular">{v}</p></div>)}
      </section>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.tourism_daily}</h2>
        {r.daily.length === 0 ? <p className="text-muted">{t.tourism_none}</p> : (
          <>
            <div className="flex h-36 items-end gap-0.5" role="img" aria-label={t.tourism_daily}>
              {r.daily.map((d) => <div key={d.k} title={`${d.k}: ${d.n}`} className="min-w-px flex-1 rounded-t bg-primary" style={{ height: `${Math.max(3, (d.n / max) * 100)}%` }} />)}
            </div>
            <p className="flex justify-between text-xs text-muted tabular"><span>{r.daily[0].k}</span><span>{r.daily[r.daily.length - 1].k}</span></p>
          </>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const rows = r.sections[s], top = Math.max(1, ...rows.map((x) => x.n ?? 0));
          return (
            <section key={s} className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-bold">{tt[SECTION_KEYS[s]]}</h2>
              {rows.length === 0 ? <p className="text-muted">{t.tourism_none}</p> : (
                <ul className="space-y-2">
                  {rows.map((x) => (
                    <li key={x.key}>
                      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate">{x.label}</span><b className="tabular">{x.n === null ? `<${MIN_CELL}` : x.n.toLocaleString("en-US")}</b></div>
                      <div className="mt-1 h-2 rounded-full bg-sky" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${((x.n ?? 0) / top) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="px-1 text-xs text-muted">{t.tourism_note.replace("{n}", String(MIN_CELL))}</p>
    </div>
  );
}
