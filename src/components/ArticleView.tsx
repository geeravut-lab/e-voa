import type { Section } from "@/lib/content/types";
import { PageHead } from "@/components/PageHead";

/** A travel article: title, summary, sections (a heading is optional) and the date. Plain text only. */
export function ArticleView({ title, hint, sections, date }: { title: string; hint?: string; sections: Section[]; date?: string }) {
  return (
    <div className="space-y-4">
      <PageHead title={title} hint={hint} art="guide" tone="mint" />
      <article className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card">
        {sections.map((s, i) => (
          <section key={i} className="space-y-2">{s.h && <h2 className="font-display text-lg font-bold">{s.h}</h2>}{s.p.map((x, j) => <p key={j} className="break-words text-sm leading-relaxed">{x}</p>)}</section>
        ))}
        {date && <p className="text-xs text-muted tabular">{date}</p>}
      </article>
    </div>
  );
}
