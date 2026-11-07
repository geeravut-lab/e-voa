import type { Lang } from "@/lib/i18n/langs";
export type Section = { h: string; p: string[] };
/** Long texts (legal pages, FAQ, guides, articles) are written for these three languages. The other languages show the English text until someone writes theirs (see forLang). */
export type WrittenLang = "en" | "th" | "zh-CN";
export type PerLang<T> = Record<WrittenLang, T>;
export const forLang = <T,>(c: PerLang<T>, lang: Lang): T => c[lang as WrittenLang] ?? c.en;
