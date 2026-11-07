import { pageMeta } from "@/lib/seo";
import { getT } from "@/lib/i18n/server";
import { loadNews } from "@/lib/content/server";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMeta({ path: "/news", title: "news_title", description: "news_hint" });

/** News and announcements written in the back office (plain text; in the reader's language, English when it is not written yet). */
export default async function NewsPage() {
  const { t, lang } = await getT();
  const items = await loadNews(lang);
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "Asia/Bangkok" });
  return (
    <div className="space-y-4">
      <PageHead title={t.news_title} hint={t.news_hint} art="notifications" tone="sand" />
      {items.length === 0 ? <p className="rounded-card border border-line bg-surface p-5 text-center text-muted shadow-card">{t.news_none}</p> : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className="space-y-2 rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-bold">{n.title}</h2>
              {n.publishedAt && <p className="text-xs text-muted tabular">{fmt.format(new Date(n.publishedAt))}</p>}
              <p className="whitespace-pre-line break-words text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
