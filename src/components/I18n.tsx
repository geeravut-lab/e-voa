"use client";
import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/langs";

const Ctx = createContext<{ t: Dict; lang: Lang } | null>(null);

export function I18nProvider({ t, lang, children }: { t: Dict; lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={{ t, lang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
export const useT = () => useI18n().t;
