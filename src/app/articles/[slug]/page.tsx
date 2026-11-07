import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { loadArticle } from "@/lib/content/server";
import { alternatesOf, langUrl } from "@/lib/seo";
import { AppLink } from "@/components/AppLink";
import { btnClass } from "@/components/buttonStyles";
import { ArticleView } from "@/components/ArticleView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const { lang } = await getT();
  const a = await loadArticle(slug, lang);
  return a ? { title: a.title, description: a.summary, alternates: alternatesOf(`/articles/${slug}`, lang), openGraph: { title: a.title, description: a.summary, type: "article", url: langUrl(`/articles/${slug}`, lang) } } : {};
}

export const dynamic = "force-dynamic";
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const { t, lang } = await getT();
  const a = await loadArticle(slug, lang);
  if (!a) notFound();
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.summary, datePublished: a.date, inLanguage: lang }).replace(/</g, "\\u003c");
  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <ArticleView title={a.title} hint={a.summary} sections={a.body} date={a.date} />
      <AppLink href="/apply" className={btnClass("gold", "w-full")}>{t.card_apply}</AppLink>
    </div>
  );
}
