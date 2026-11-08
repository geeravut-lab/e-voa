import type { Lang } from "@/lib/i18n/langs";
export type Section = { h: string; p: string[] };
/** Long texts (legal pages, FAQ, guides, articles) are written for these three languages. The other languages show the English text until someone writes theirs (see forLang). */
export type WrittenLang = "en" | "th" | "zh-CN";
/** The six languages added later: the traveler toolkit (emergency, phrases, rules, incident guides, rental, weather advice, family check-in) is translated into them in content/lang/<code>*.ts. */
export type ExtraLang = "hi" | "ar" | "ru" | "ko" | "ja" | "zh-TW";
export const EXTRA_LANGS: ExtraLang[] = ["hi", "ar", "ru", "ko", "ja", "zh-TW"];
export type PerLang<T> = Record<WrittenLang, T> & Partial<Record<ExtraLang, T>>;
export const forLang = <T,>(c: PerLang<T>, lang: Lang): T => (c as Partial<Record<Lang, T>>)[lang] ?? c.en;
