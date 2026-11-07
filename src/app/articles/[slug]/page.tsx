import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ARTICLES } from "@/lib/content/articles";
import { forLang } from "@/lib/content/types";
import { alternatesOf, langUrl } from "@/lib/seo";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const { lang } = await getT();
  const a = forLang(ARTICLES, lang).find((x) => x.slug === slug);
  return a ? { title: a.title, description: a.summary, alternates: alternatesOf(`/articles/${slug}`, lang), openGraph: { title: a.title, description: a.summary, type: "article", url: langUrl(`/articles/${slug}`, lang) } } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const { t, lang } = await getT();
  const a = forLang(ARTICLES, lang).find((x) => x.slug === slug);
  if (!a) notFound();
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.summary, datePublished: a.date, inLanguage: lang }).replace(/</g, "\\u003c");
  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <LegalPage title={a.title} hint={a.summary} sections={a.body} version={a.date} />
      <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>
    </div>
  );
}
