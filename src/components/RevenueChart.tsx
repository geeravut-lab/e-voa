import { REVENUE_CATEGORIES, type RevenueCategory, type Summary } from "@/lib/revenue/aggregate";
import type { Bucket } from "@/lib/revenue/range";

export const CAT_FILL: Record<RevenueCategory, string> = { evoa: "fill-primary", insurance: "fill-teal", sim: "fill-gold", vip: "fill-lotus", health: "fill-success" };
export const CAT_BG: Record<RevenueCategory, string> = { evoa: "bg-primary", insurance: "bg-teal", sim: "bg-gold", vip: "bg-lotus", health: "bg-success" };

const niceMax = (v: number) => { if (v <= 0) return 100; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n));

/** Stacked columns of net revenue per time bucket, drawn as plain SVG on the server (no chart library). Decorative: the table under it carries the same numbers. */
export function RevenueChart({ series, bucket, label }: { series: Summary["series"]; bucket: Bucket; label: string }) {
  const W = 720, H = 260, L = 46, B = 30, T = 10, R = 8, n = series.length || 1;
  const stacks = series.map((s) => REVENUE_CATEGORIES.map((c) => Math.max(s.net[c], 0)));
  const max = niceMax(Math.max(...stacks.map((st) => st.reduce((a, b) => a + b, 0)), 0));
  const plotW = W - L - R, plotH = H - T - B, slot = plotW / n, bar = Math.max(Math.min(slot * 0.7, 44), 2);
  const step = Math.ceil(n / (bucket === "hour" ? 12 : 10));
  const tick = (k: string) => (bucket === "hour" ? `${k}:00` : bucket === "month" ? k.slice(5) : k.slice(8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => { const y = T + plotH * (1 - f); return (<g key={f}><line x1={L} x2={W - R} y1={y} y2={y} className="stroke-line" strokeWidth="1" /><text x={L - 6} y={y + 4} textAnchor="end" className="fill-muted text-[11px] tabular">{short(Math.round(max * f))}</text></g>); })}
      {series.map((s, i) => {
        let y = T + plotH; const x = L + slot * i + (slot - bar) / 2;
        return (
          <g key={s.key}>
            {REVENUE_CATEGORIES.map((c, ci) => { const h = (stacks[i][ci] / max) * plotH; if (h <= 0) return null; y -= h; return <rect key={c} x={x} y={y} width={bar} height={h} rx="2" className={CAT_FILL[c]}><title>{`${s.key} · ${c}: ${stacks[i][ci].toLocaleString("en-US")}`}</title></rect>; })}
            {i % step === 0 && <text x={x + bar / 2} y={H - 10} textAnchor="middle" className="fill-muted text-[11px] tabular">{tick(s.key)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
