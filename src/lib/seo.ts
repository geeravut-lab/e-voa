import "server-only";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/env";
import { LANG_CODES, LANGS } from "@/lib/i18n/langs";
import { getT } from "@/lib/i18n/server";
import type { DictKey } from "@/lib/i18n/dict";

/** The address of one language version of a public page. The default (no ?lang=) is what visitors without a saved choice see. */
export const langUrl = (path: string, lang: string) => `${SITE_URL}${path === "/" ? "" : path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

/** hreflang alternates for a public page: one entry per language plus x-default, and a canonical address for the language being shown. */
export const alternatesOf = (path: string, lang: string) => ({
  canonical: langUrl(path, lang),
  languages: { ...Object.fromEntries(LANG_CODES.map((l) => [LANGS[l].htmlLang, langUrl(path, l)])), "x-default": `${SITE_URL}${path === "/" ? "" : path}` || SITE_URL },
});

/** Title and description come from the dictionaries, so a Thai page has a Thai title and description in search results. */
export async function pageMeta(a: { path: string; title: DictKey; description: DictKey }): Promise<Metadata> {
  const { t, lang } = await getT();
  return { title: t[a.title], description: t[a.description], alternates: alternatesOf(a.path, lang), openGraph: { title: t[a.title], description: t[a.description], url: langUrl(a.path, lang), locale: LANGS[lang].htmlLang.replace("-", "_") } };
}
