/**
 * Language registry. To add a language (hi, ar, ru, ko, ja, zh-TW …):
 *  1. add it here  2. create dict/<code>.ts with `satisfies Dict`  3. register it in dict/index.ts
 * The compiler then fails until every key is translated. Right-to-left languages only need dir: "rtl".
 */
export const LANGS = {
  en: { native: "English", htmlLang: "en", dir: "ltr", short: "EN" },
  th: { native: "ไทย", htmlLang: "th", dir: "ltr", short: "TH" },
  "zh-CN": { native: "简体中文", htmlLang: "zh-CN", dir: "ltr", short: "中文" },
} as const;

export type Lang = keyof typeof LANGS;
export const LANG_CODES = Object.keys(LANGS) as Lang[];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "evoa_lang";

export const isLang = (v: unknown): v is Lang => typeof v === "string" && v in LANGS;

/** Picks the best supported language from an Accept-Language header. */
export function pickLang(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const wanted = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    if (tag.startsWith("zh")) return "zh-CN";
    const base = tag.split("-")[0];
    if (isLang(base)) return base;
  }
  return DEFAULT_LANG;
}
