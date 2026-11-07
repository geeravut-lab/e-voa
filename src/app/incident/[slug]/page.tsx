import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { LAST_REVIEWED, EMERGENCY } from "@/lib/content/toolkit";
import { INCIDENT_NOTE } from "@/lib/content/incidents";
import { loadToolkit } from "@/lib/content/toolkit-server";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What to do" };

/** One situation: who to call first, then the steps in order. Public; works without signing in. */
export default async function IncidentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, lang } = await getT();
  const tk = await loadToolkit();
  const inc = tk.incidents.find((i) => i.id === slug); if (!inc) notFound();
  const names = new Map(tk.emergency.concat(EMERGENCY).map((e) => [e.number, e.label]));
  const steps = forLang(inc.steps, lang);
  return (
    <div className="space-y-4">
      <PageHead title={forLang(inc.title, lang)} hint={forLang(inc.summary, lang)} art="emergency" tone="rose" />
      {inc.call.length > 0 && (
        <section className="space-y-2 rounded-card border border-danger bg-danger-bg p-5" aria-label={t.inc_call_first}>
          <h2 className="font-display text-lg font-bold text-danger">{t.inc_call_first}</h2>
          <div className="flex flex-wrap gap-2">{inc.call.map((n) => <a key={n} href={`tel:${n}`} className={btnClass("danger", "tabular")}>☎ {n}{names.get(n) ? ` · ${forLang(names.get(n)!, lang)}` : ""}</a>)}</div>
        </section>
      )}
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.inc_steps}</h2>
        <ol className="space-y-3">{steps.map((s, i) => (
          <li key={i} className="flex gap-3"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white">{i + 1}</span><span className="pt-1 text-[15px]">{s}</span></li>
        ))}</ol>
      </section>
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{forLang(INCIDENT_NOTE, lang).replace("{when}", tk.reviewed.incidents?.slice(0, 7) ?? LAST_REVIEWED)}</p>
      <div className="flex flex-wrap gap-2">
        <AppLink href="/incident" className={btnClass("ghost")}>{t.inc_back}</AppLink><AppLink href="/emergency" className={btnClass("ghost")}>{t.inc_more_help}</AppLink>
        {slug === "flood-storm" && <AppLink href="/conditions" className={btnClass("ghost")}>{t.tk_conditions}</AppLink>}
        {(slug === "road-accident" || slug === "scam") && <AppLink href="/rental" className={btnClass("ghost")}>{t.tk_rental}</AppLink>}
        {slug === "lost-passport" && <AppLink href="/trips" className={btnClass("ghost")}>{t.card_trips}</AppLink>}
      </div>
    </div>
  );
}
