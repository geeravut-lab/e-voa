"use client";
import { useState } from "react";
import { useT } from "@/components/I18n";
import { btnClass } from "@/components/buttonStyles";
import type { Phrase } from "@/lib/content/toolkit";

const meaning = (p: Phrase, lang: string) => (p.more as Record<string, string | undefined> | undefined)?.[lang] ?? (lang === "zh-CN" || lang === "zh-TW" ? p.zh : p.en);
/** A list of phrases: tap one to show it full-screen in big Thai letters for the other person to read. */
export function PhraseCard({ phrases, lang }: { phrases: Phrase[]; lang: string }) {
  const t = useT();
  const [open, setOpen] = useState<Phrase | null>(null);
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {phrases.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-2 text-start hover:bg-sky">
              <span><b className="block">{meaning(p, lang)}</b><span className="block text-xs text-muted">{p.roman}</span></span>
              <span lang="th" className="shrink-0 text-lg font-bold text-primary">{p.th}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={meaning(open, lang)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink p-6 text-center text-white">
          <p lang="th" className="font-display text-5xl font-extrabold leading-snug sm:text-7xl">{open.th}</p>
          <p className="text-xl text-white/80">{open.roman}</p>
          <p className="text-base text-white/70">{meaning(open, lang)}</p>
          <button type="button" autoFocus onClick={() => setOpen(null)} className={btnClass("gold", "min-w-40")}>{t.phrases_close}</button>
        </div>
      )}
    </>
  );
}
