import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { PageHead } from "@/components/PageHead";
import { NavRowLink } from "@/components/AppLink";

export const generateMetadata = () => pageMeta({ path: "/toolkit", title: "toolkit_title", description: "toolkit_hint" });

/** The small tools for the stay itself. Every one works without signing in. */
export default async function ToolkitPage() {
  const { t } = await getT();
  const tools = [
    { href: "/stay", title: t.tk_stay, sub: t.tk_stay_sub, tone: "tone-mint" },
    { href: "/tdac", title: t.tk_tdac, sub: t.tk_tdac_sub, tone: "tone-sky" },
    { href: "/check-rules", title: t.tk_rules, sub: t.tk_rules_sub, tone: "tone-rose" },
    { href: "/phrases", title: t.tk_phrases, sub: t.tk_phrases_sub, tone: "tone-gold" },
    { href: "/emergency", title: t.card_emergency, sub: t.card_emergency_sub, tone: "tone-sand" },
  ];
  return (
    <div className="space-y-4">
      <PageHead title={t.toolkit_title} hint={t.toolkit_hint} art="toolkit" tone="mint" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {tools.map((x) => (
          <li key={x.href}><NavRowLink href={x.href} className={`${x.tone} block min-h-24 rounded-card border p-5 shadow-card`}><b className="block font-display text-lg">{x.title}</b><span className="text-sm text-muted">{x.sub}</span></NavRowLink></li>
        ))}
      </ul>
    </div>
  );
}
