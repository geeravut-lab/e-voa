import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ARRIVAL } from "@/lib/content/guide";
import { PageHead } from "@/components/PageHead";

export const metadata: Metadata = { title: "Airport guide", description: "What to do when you land in Thailand with an approved e-VOA." };

export default async function GuidePage() {
  const { t, lang } = await getT();
  const c = ARRIVAL[lang];
  return (
    <div className="space-y-4">
      <PageHead title={t.card_guide} hint={c.intro} art="guide" tone="mint" />
      <ol className="space-y-3">{c.steps.map((s, n) => (
        <li key={s.h} className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint font-extrabold text-teal-deep">{n + 1}</span><span><b className="block">{s.h}</b><span className="text-sm text-muted">{s.p}</span></span></li>
      ))}</ol>
      <section className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.guide_airports}</h2>
        <ul className="divide-y divide-line">{c.airports.map((a) => <li key={a.h} className="py-2"><b className="block text-sm">{a.h}</b><span className="text-sm text-muted">{a.p}</span></li>)}</ul>
      </section>
      <p className="rounded-control bg-gold-soft p-3 text-sm text-gold-deep">{c.note}</p>
    </div>
  );
}
