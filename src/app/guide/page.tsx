import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { ARRIVAL } from "@/lib/content/guide";
import { PageHead } from "@/components/PageHead";
import { loadAirportNotes } from "@/lib/airports";

export const generateMetadata = () => pageMeta({ path: "/guide", title: "card_guide", description: "seo_guide" });

export default async function GuidePage() {
  const { t, lang } = await getT();
  const c = ARRIVAL[lang]; const notes = await loadAirportNotes();
  return (
    <div className="space-y-4">
      <PageHead title={t.card_guide} hint={c.intro} art="guide" tone="mint" />
      <ol className="space-y-3">{c.steps.map((s, n) => (
        <li key={s.h} className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint font-extrabold text-teal-deep">{n + 1}</span><span><b className="block">{s.h}</b><span className="text-sm text-muted">{s.p}</span></span></li>
      ))}</ol>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.guide_airports}</h2>
        <ul className="divide-y divide-line">{c.airports.map((a) => { const code = a.h.match(/\(([A-Z]{3})\)/)?.[1] as "BKK" | undefined; const extra = code ? notes[code]?.[lang] : undefined; return <li key={a.h} className="space-y-1 py-2"><b className="block text-sm">{a.h}</b><span className="text-sm text-muted">{a.p}</span>{extra && <p className="whitespace-pre-line rounded-control bg-sky p-3 text-sm">{extra}</p>}</li>; })}</ul>
      </section>
      <p className="rounded-control bg-gold-soft p-3 text-sm text-gold-deep">{c.note}</p>
    </div>
  );
}
