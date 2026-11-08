import type { ReactNode } from "react";
import { NEWS_IMG_PREFIX, isExternal, parseRich, type Block, type Inline } from "@/lib/content/rich";

/** Shows staff-written rich text (see lib/content/rich.ts). Plain React elements only: nothing typed by staff is ever inserted as HTML. Works on the server and in the editor preview. */
function inline(c: Inline[], k = ""): ReactNode[] {
  return c.map((x, i) => {
    const key = `${k}${i}`;
    if (x.t === "text") return x.v;
    if (x.t === "b") return <strong key={key}>{inline(x.c, key)}</strong>;
    if (x.t === "i") return <em key={key}>{inline(x.c, key)}</em>;
    const ext = isExternal(x.href);
    return <a key={key} href={x.href} className="font-semibold text-primary underline underline-offset-2" {...(ext ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{inline(x.c, key)}</a>;
  });
}
function block(b: Block, i: number): ReactNode {
  switch (b.t) {
    case "h": return b.level === 2 ? <h3 key={i} className="mt-2 font-display text-lg font-bold">{inline(b.c)}</h3> : <h4 key={i} className="mt-1 font-display text-base font-bold">{inline(b.c)}</h4>;
    case "p": return <p key={i} className="whitespace-pre-line break-words">{inline(b.c)}</p>;
    case "ul": return <ul key={i} className="list-disc space-y-1 ps-6">{b.items.map((it, j) => <li key={j} className="break-words">{inline(it)}</li>)}</ul>;
    case "ol": return <ol key={i} className="list-decimal space-y-1 ps-6">{b.items.map((it, j) => <li key={j} className="break-words">{inline(it)}</li>)}</ol>;
    case "quote": return <blockquote key={i} className="break-words rounded-control border-s-4 border-primary bg-sky p-3 font-medium">{inline(b.c)}</blockquote>;
    case "hr": return <hr key={i} className="border-line" />;
    case "img": return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own /news-img route, already resized when uploaded
      <img key={i} src={`${NEWS_IMG_PREFIX}${b.name}`} alt={b.alt} loading="lazy" decoding="async" className="h-auto max-w-full rounded-card border border-line" />
    );
  }
}
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return <div className={`space-y-3 text-sm leading-relaxed ${className}`}>{parseRich(text).map(block)}</div>;
}
