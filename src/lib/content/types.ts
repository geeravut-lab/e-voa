import type { Lang } from "@/lib/i18n/langs";
export type Section = { h: string; p: string[] };
/** Content written per language. `Record<Lang, …>` makes the compiler demand every language, so a new language cannot be added without its texts. */
export type PerLang<T> = Record<Lang, T>;
