import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { LAST_REVIEWED } from "@/lib/content/toolkit";
import { INCIDENT_NOTE } from "@/lib/content/incidents";
import { loadToolkit } from "@/lib/content/toolkit-server";
import { PageHead } from "@/components/PageHead";
import { AppLink, NavRowLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/incident", title: "inc_title", description: "inc_hint" });
export const dynamic = "force-dynamic";

export default async function IncidentHub() {
  const { t, lang } = await getT();
  const tk = await loadToolkit();
  return (
    <div className="space-y-4">
      <PageHead title={t.inc_title} hint={t.inc_hint} art="emergency" tone="rose" />
      <a href="tel:1669" className={btnClass("danger", "w-full tabular")}>☎ {t.emergency_call.replace("{n}", "1669")}</a>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tk.incidents.map((i) => (
          <li key={i.id}><NavRowLink href={`/incident/${i.id}`} className="block min-h-24 rounded-card border border-line bg-surface p-5 shadow-card"><b className="block font-display text-lg">{forLang(i.title, lang)}</b><span className="text-sm text-muted">{forLang(i.summary, lang)}</span></NavRowLink></li>
        ))}
      </ul>
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{forLang(INCIDENT_NOTE, lang).replace("{when}", tk.reviewed.incidents?.slice(0, 7) ?? LAST_REVIEWED)}</p>
      <div className="flex flex-wrap gap-2"><AppLink href="/emergency" className={btnClass("ghost")}>{t.card_emergency}</AppLink><AppLink href="/phrases" className={btnClass("ghost")}>{t.tk_phrases}</AppLink></div>
    </div>
  );
}
