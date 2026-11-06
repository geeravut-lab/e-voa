import type { Section } from "@/lib/content/types";
import { PageHead } from "@/components/PageHead";

export function LegalPage({ title, hint, sections, version }: { title: string; hint?: string; sections: Section[]; version: string }) {
  return (
    <div className="space-y-4">
      <PageHead title={title} hint={hint} art="account" tone="sky" />
      <article className="space-y-5 rounded-card border border-line bg-surface p-5 shadow-card">
        {sections.map((s, i) => (
          <section key={i} className="space-y-2"><h2 className="font-display text-lg font-bold">{i + 1}. {s.h}</h2>{s.p.map((x, j) => <p key={j} className="text-[15px] leading-relaxed">{x}</p>)}</section>
        ))}
        <p className="text-xs text-muted tabular">v {version}</p>
      </article>
    </div>
  );
}
