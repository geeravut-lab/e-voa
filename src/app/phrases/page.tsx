import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { PHRASES } from "@/lib/content/toolkit";
import { PageHead } from "@/components/PageHead";
import { PhraseCard } from "@/components/PhraseCard";

export const generateMetadata = () => pageMeta({ path: "/phrases", title: "phrases_title", description: "phrases_hint" });
export const dynamic = "force-dynamic";

export default async function PhrasesPage() {
  const { t, lang } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.phrases_title} hint={t.phrases_hint} art="toolkit" tone="sky" />
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card"><h2 className="font-display text-lg font-bold">{t.phrases_urgent}</h2><PhraseCard phrases={PHRASES.filter((p) => p.urgent)} lang={lang} /></section>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5 shadow-card"><h2 className="font-display text-lg font-bold">{t.phrases_everyday}</h2><PhraseCard phrases={PHRASES.filter((p) => !p.urgent)} lang={lang} /></section>
    </div>
  );
}
