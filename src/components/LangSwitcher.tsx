"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLangAction } from "@/app/actions/session";
import { LANGS, LANG_CODES, type Lang } from "@/lib/i18n/langs";
import { useI18n } from "./I18n";
import { Spinner } from "./Spinner";

/** Segmented language switch. The pressed language shows a spinner until the page has re-rendered in the new language. */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState<Lang | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Language">
      {LANG_CODES.map((code) => {
        const active = code === lang;
        const loading = pending && target === code;
        return (
          <button
            key={code}
            type="button"
            disabled={pending}
            aria-pressed={active}
            aria-busy={loading}
            onClick={() => {
              if (active || pending) return;
              setTarget(code);
              start(async () => {
                await setLangAction(code);
                router.refresh();
              });
            }}
            className={`inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] font-bold transition ${
              active ? "bg-primary text-white" : "text-muted hover:bg-sky"
            } ${compact ? "min-w-9" : "min-w-12 px-3"}`}
            lang={LANGS[code].htmlLang}
          >
            {loading && <Spinner size={12} />}
            {compact ? LANGS[code].short : LANGS[code].native}
          </button>
        );
      })}
    </div>
  );
}
