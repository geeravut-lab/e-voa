import { en, type Dict } from "./en";
import { th } from "./th";
import { zhCN } from "./zh-CN";
import { hi } from "./hi";
import { ar } from "./ar";
import { ru } from "./ru";
import { ko } from "./ko";
import { ja } from "./ja";
import { zhTW } from "./zh-TW";
import type { Lang } from "../langs";

export type { Dict };
/** English, Thai and Simplified Chinese are complete. The other languages translate everything a traveler sees; back-office texts and anything not translated yet show in English. */
const withEnglish = (part: Partial<Dict>): Dict => ({ ...en, ...part });
export const DICTS: Record<Lang, Dict> = { en, th, "zh-CN": zhCN, hi: withEnglish(hi), ar: withEnglish(ar), ru: withEnglish(ru), ko: withEnglish(ko), ja: withEnglish(ja), "zh-TW": withEnglish(zhTW) };
export const PARTIAL_LANGS: Lang[] = ["hi", "ar", "ru", "ko", "ja", "zh-TW"];
export type DictKey = keyof Dict;

/** Replaces {name}-style placeholders. */
export function fmt(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Turns a server error code (err_*) into a sentence in the user's language. Unknown codes become a generic message. */
export function errorText(code: string | undefined | null, t: Dict): string {
  if (!code) return t.err_generic;
  const v = (t as Record<string, string>)[code];
  return v ?? t.err_generic;
}
