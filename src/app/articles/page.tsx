import { getT } from "@/lib/i18n/server";
import { loadArticles } from "@/lib/content/server";
import { pageMeta } from "@/lib/seo";
import { NavRowLink } from "@/components/AppLink";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMeta({ path: "/articles", title: "articles_title", description: "seo_articles" });

export default async function ArticlesPage() {
  const { t, lang } = await getT();
  return (
    <div className="space-y-4">
      <PageHead title={t.articles_title} hint={t.seo_articles} art="articles" tone="sky" />
      <ul className="space-y-3">{(await loadArticles(lang)).map((a) => (
        <li key={a.slug}><NavRowLink href={`/articles/${a.slug}`} className="block rounded-card border border-line bg-surface p-4 shadow-card"><b className="block font-display text-lg">{a.title}</b><span className="text-sm text-muted">{a.summary}</span></NavRowLink></li>
      ))}</ul>
    </div>
  );
}
