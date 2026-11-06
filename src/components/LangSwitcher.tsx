"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { setLangAction } from "@/app/actions/session";
import { LANGS, LANG_CODES, type Lang } from "@/lib/i18n/langs";
import { useI18n } from "./I18n";
import { Spinner } from "./Spinner";

/**
 * Language drop-down: a small pill with the current language and a caret; the list opens below (or above, near the bottom of the screen).
 * The chosen language shows a spinner until the page has re-rendered in it.
 */
export function LangSwitcher({ compact = false, up = false }: { compact?: boolean; up?: boolean }) {
  const { lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("touchstart", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (code: Lang) => {
    if (code === lang || pending) { setOpen(false); return; }
    start(async () => {
      await setLangAction(code);
      const u = new URL(window.location.href);                  // a ?lang= in the address would keep overriding the new choice
      if (u.searchParams.has("lang")) { u.searchParams.delete("lang"); router.replace(u.pathname + u.search); }
      router.refresh();
      setOpen(false);
    });
  };

  return (
    <div ref={box} className={`relative ${compact ? "inline-block" : "block w-full"}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label="Language"
        aria-busy={pending}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 items-center justify-between gap-2 rounded-full border border-line bg-surface px-4 text-[15px] font-bold text-ink shadow-sm transition hover:bg-sky ${compact ? "" : "w-full"}`}
        lang={LANGS[lang].htmlLang}
      >
        <span>{compact ? LANGS[lang].short : LANGS[lang].native}</span>
        {pending ? <Spinner size={14} /> : <ChevronDown size={16} aria-hidden="true" className={`transition ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label="Language" className={`absolute z-50 min-w-40 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-card ${compact ? "right-0" : "left-0 w-full"} ${up ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {LANG_CODES.map((code) => {
            const active = code === lang;
            return (
              <li key={code} role="presentation">
                <button type="button" role="option" aria-selected={active} disabled={pending} onClick={() => choose(code)} lang={LANGS[code].htmlLang}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-semibold transition hover:bg-sky ${active ? "text-primary" : "text-ink"}`}>
                  <span>{LANGS[code].native}</span>
                  {active && <Check size={16} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
