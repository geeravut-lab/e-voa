import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { PREPARE } from "@/lib/content/guide";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/prepare", title: "prepare_title", description: "seo_prepare" });

export default async function PreparePage() {
  const { t, lang } = await getT();
  const c = PREPARE[lang];
  return (
    <div className="space-y-4">
      <PageHead title={t.prepare_title} hint={c.intro} art="check" tone="mint" />
      <ol className="space-y-3">{c.items.map((i, n) => (
        <li key={i.h} className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky font-extrabold text-primary">{n + 1}</span><span><b className="block">{i.h}</b><span className="text-sm text-muted">{i.p}</span></span></li>
      ))}</ol>
      <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>
    </div>
  );
}
