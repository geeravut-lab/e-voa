"use client";
import { useMemo, useState } from "react";
import { useT } from "@/components/I18n";
import { inputCls } from "@/components/apply/fields";

/** Questions with a search box (matches words in the question or the answer). Each answer opens and closes without leaving the page. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const shown = useMemo(() => { const w = q.trim().toLowerCase(); return w ? items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(w)) : items; }, [q, items]);
  return (
    <div className="space-y-3">
      <label className="block"><span className="sr-only">{t.faq_search}</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.faq_search} className={inputCls} /></label>
      {shown.length === 0 && <p className="rounded-card border border-line bg-surface p-5 text-center text-muted">{t.faq_none}</p>}
      <ul className="space-y-2">{shown.map((i) => (
        <li key={i.q}><details className="group rounded-card border border-line bg-surface p-4 shadow-card"><summary className="cursor-pointer list-none font-semibold marker:content-none"><span className="mr-2 text-primary group-open:hidden">＋</span><span className="mr-2 hidden text-primary group-open:inline">－</span>{i.q}</summary><p className="mt-2 text-[15px] leading-relaxed">{i.a}</p></details></li>
      ))}</ul>
    </div>
  );
}
