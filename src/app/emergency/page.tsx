import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { EMERGENCY, EMERGENCY_NOTE, PHRASES } from "@/lib/content/toolkit";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";
import { LocationBox } from "@/components/LocationBox";
import { PhraseCard } from "@/components/PhraseCard";

export const generateMetadata = () => pageMeta({ path: "/emergency", title: "emergency_title", description: "emergency_hint" });
export const dynamic = "force-dynamic";

/** Public, no sign-in: numbers that dial on tap, a position box that never leaves the phone, and the urgent Thai phrases. */
export default async function EmergencyPage() {
  const { t, lang } = await getT();
  const pick = <T,>(m: { en: T; th: T; "zh-CN": T }) => forLang(m, lang);
  const urgent = PHRASES.filter((p) => p.urgent);
  return (
    <div className="space-y-4">
      <PageHead title={t.emergency_title} hint={t.emergency_hint} art="emergency" tone="rose" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {EMERGENCY.map((e) => (
          <li key={e.number} className="space-y-1 rounded-card border border-line bg-surface p-4 shadow-card">
            <b className="block font-display text-lg">{pick(e.label)}</b>
            <p className="text-sm text-muted">{pick(e.use)}</p>
            <a href={`tel:${e.number}`} className={btnClass(e.number === "1669" || e.number === "191" || e.number === "1155" ? "danger" : "primary", "mt-2 w-full tabular")}>☎ {t.emergency_call.replace("{n}", e.number)}</a>
          </li>
        ))}
      </ul>
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{pick(EMERGENCY_NOTE)}</p>
      <LocationBox />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">{t.emergency_phrases}</h2>
        <PhraseCard phrases={urgent} lang={lang} />
        <AppLink href="/phrases" className={btnClass("ghost")}>{t.emergency_more}</AppLink>
      </section>
      <div className="flex flex-wrap gap-2">
        <a href="/offline-emergency.html" className={btnClass("ghost")}>{t.emergency_offline}</a>
        <AppLink href="/official" className={btnClass("ghost")}>{t.official_channels_link}</AppLink>
      </div>
    </div>
  );
}
