import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { forLang } from "@/lib/content/types";
import { LAST_REVIEWED, LEVEL_LABEL, RULES_NOTE } from "@/lib/content/toolkit";
import { loadToolkit } from "@/lib/content/toolkit-server";
import { PageHead } from "@/components/PageHead";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/check-rules", title: "rc_title", description: "rc_hint" });
export const dynamic = "force-dynamic";
const BADGE = { illegal: "bg-danger-bg text-danger", restricted: "bg-gold-soft text-gold-deep", respect: "bg-sky text-primary", careful: "bg-mint text-teal-deep" } as const;

export default async function RulesCheckPage() {
  const { t, lang } = await getT();
  const tk = await loadToolkit(), RULES_CHECK = tk.rules;
  return (
    <div className="space-y-4">
      <PageHead title={t.rc_title} hint={t.rc_hint} art="toolkit" tone="rose" />
      <ul className="space-y-3">
        {RULES_CHECK.map((r) => (
          <li key={r.id} className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold">{forLang(r.title, lang)}</h2><span className={`rounded-full px-3 py-0.5 text-xs font-extrabold ${BADGE[r.level]}`}>{forLang(LEVEL_LABEL[r.level], lang)}</span></div>
            <p className="text-[15px]">{forLang(r.text, lang)}</p>
          </li>
        ))}
      </ul>
      <p className="rounded-control bg-gold-soft p-3 text-sm font-semibold text-gold-deep">{forLang(RULES_NOTE, lang).replace("{when}", tk.reviewed.rules?.slice(0, 7) ?? LAST_REVIEWED)}</p>
      <AppLink href="/official" className={btnClass("ghost")}>{t.official_channels_link}</AppLink>
    </div>
  );
}
