import { pageMeta } from "@/lib/seo";
import { featureEnabled } from "@/lib/flags";
import { aiConfigured, loadAi } from "@/lib/ai/settings";
import { getT } from "@/lib/i18n/server";
import { FAQ } from "@/lib/content/faq";
import { forLang } from "@/lib/content/types";
import { FaqList } from "@/components/FaqList";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const generateMetadata = () => pageMeta({ path: "/help", title: "faq_title", description: "seo_help" });

export default async function HelpPage() {
  const { t, lang } = await getT();
  const items = forLang(FAQ, lang);
  const showAi = (await featureEnabled("ai_assistant")) && aiConfigured() && (await loadAi()).enabled;
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) }).replace(/</g, "\\u003c");
  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <PageHead title={t.faq_title} hint={t.card_help_sub} art="help" tone="sky" />
      {showAi && <AppLink href="/help/chat" className={btnClass("primary", "w-full")}>{t.ai_title}</AppLink>}
      <FaqList items={items} />
      <section className="grid gap-2 sm:grid-cols-2">
        <AppLink href="/status" className={btnClass("ghost")}>{t.status_title}</AppLink>
        <AppLink href="/official" className={btnClass("ghost")}>{t.official_title}</AppLink>
        <AppLink href="/prepare" className={btnClass("ghost")}>{t.prepare_title}</AppLink>
        <AppLink href="/guide" className={btnClass("ghost")}>{t.card_guide}</AppLink>
        <AppLink href="/articles" className={btnClass("ghost")}>{t.articles_title}</AppLink>
      </section>
    </div>
  );
}
