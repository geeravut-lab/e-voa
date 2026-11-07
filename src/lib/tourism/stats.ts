// Anonymous tourism statistics for the Government / TAT view. Pure (no database). The database only returns counts; this file decides what may be shown:
// a group smaller than MIN_CELL is never shown on its own, it is folded into "other" and shown as "<5" if it is still small.
export const MIN_CELL = 5;
export const SECTIONS = ["nationality", "airport", "purpose", "gender", "age", "stay", "package"] as const;
export type Section = (typeof SECTIONS)[number];
export type Count = { k: string; n: number };
export type RawStats = { funnel: Record<string, number>; daily: Count[]; sections: Record<Section, Count[]>; avgDecisionHours: number | null; avgLeadDays: number | null };
export type Shown = { key: string; label: string; n: number | null };            // n === null → "fewer than MIN_CELL"
export const OTHER = "__other", UNKNOWN = "unknown";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const counts = (v: unknown): Count[] => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object").map((r) => ({ k: String((r as { k?: unknown }).k ?? UNKNOWN), n: num((r as { n?: unknown }).n) })) : []);
const avg = (v: unknown) => { const n = Number(v); return v === null || v === undefined || !Number.isFinite(n) ? null : n; };

/** A damaged or empty answer becomes zeros: the page must always open. */
export function parseStats(v: unknown): RawStats {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const funnel: Record<string, number> = {}; for (const [k, n] of Object.entries((o.funnel && typeof o.funnel === "object" ? o.funnel : {}) as Record<string, unknown>)) funnel[k] = num(n);
  return { funnel, daily: counts(o.daily), sections: Object.fromEntries(SECTIONS.map((s) => [s, counts(o[s])])) as Record<Section, Count[]>, avgDecisionHours: avg(o.avg_decision_hours), avgLeadDays: avg(o.avg_lead_days) };
}

export const arrivals = (s: RawStats) => s.daily.reduce((t, d) => t + d.n, 0);

/** Biggest first; every group under MIN_CELL is merged into one "other" row, which itself shows "<5" while it is under MIN_CELL. `top` keeps the biggest groups and folds the rest into "other" too. */
export function suppress(rows: Count[], label: (key: string) => string, opts: { min?: number; top?: number } = {}): Shown[] {
  const min = opts.min ?? MIN_CELL, top = opts.top ?? Infinity;
  const sorted = rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  const shown: Shown[] = []; let other = 0;
  for (const r of sorted) { if (r.n >= min && shown.length < top) shown.push({ key: r.k, label: label(r.k), n: r.n }); else { other += r.n; } }
  if (other > 0) shown.push({ key: OTHER, label: label(OTHER), n: other >= min ? other : null });
  return shown;
}

export type Report = { from: string; to: string; arrivals: number; received: number; approved: number; rejected: number; approvalRate: number | null; avgDecisionHours: number | null; avgLeadDays: number | null; daily: Count[]; sections: Record<Section, Shown[]> };

export function buildReport(raw: RawStats, range: { from: string; to: string }, label: (section: Section, key: string) => string): Report {
  const f = raw.funnel, approved = (f.approved ?? 0) + (f.used ?? 0), rejected = f.rejected ?? 0, received = Object.values(f).reduce((t, n) => t + n, 0), decided = approved + rejected;
  return { from: range.from, to: range.to, arrivals: arrivals(raw), received, approved, rejected, approvalRate: decided ? Math.round((approved / decided) * 1000) / 10 : null, avgDecisionHours: raw.avgDecisionHours, avgLeadDays: raw.avgLeadDays, daily: raw.daily,
    sections: Object.fromEntries(SECTIONS.map((s) => [s, suppress(raw.sections[s], (k) => label(s, k), { top: s === "nationality" || s === "airport" ? 15 : undefined })])) as Record<Section, Shown[]> };
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
/** One CSV with every section (what the page shows, small groups as "<5"). */
export function reportCsv(r: Report, sectionTitle: (s: Section) => string): string {
  const lines = ["section,label,count", `period,${r.from},${r.to}`, `arrivals,total,${r.arrivals}`, `funnel,received,${r.received}`, `funnel,approved,${r.approved}`, `funnel,rejected,${r.rejected}`];
  for (const d of r.daily) lines.push(`daily,${d.k},${d.n}`);
  for (const s of SECTIONS) for (const row of r.sections[s]) lines.push(`${q(sectionTitle(s))},${q(row.label)},${row.n === null ? `<${MIN_CELL}` : row.n}`);
  return lines.join("\r\n") + "\r\n";
}
