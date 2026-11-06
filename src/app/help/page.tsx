import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { FAQ } from "@/lib/content/faq";
import { FaqList } from "@/components/FaqList";
import { AppLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";
import { btnClass } from "@/components/buttonStyles";

export const metadata: Metadata = { title: "Help and questions", description: "Answers about applying for the Thailand Visa on Arrival (e-VOA): who can apply, cost, time, refunds, documents and the airport." };

export default async function HelpPage() {
  const { t, lang } = await getT();
  const items = FAQ[lang];
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) }).replace(/</g, "\\u003c");
  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <PageHead title={t.faq_title} hint={t.card_help_sub} art="help" tone="sky" />
      <FaqList items={items} />
      <section className="grid gap-2 sm:grid-cols-2">
        <AppLink href="/status" className={btnClass("ghost")}>{t.status_title}</AppLink>
        <AppLink href="/official" className={btnClass("ghost")}>{t.official_title}</AppLink>
        <AppLink href="/prepare" className={btnClass("ghost")}>{t.prepare_title}</AppLink>
        <AppLink href="/guide" className={btnClass("ghost")}>{t.card_guide}</AppLink>
      </section>
    </div>
  );
}
