import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { LANG_CODES, LANGS } from "@/lib/i18n/langs";
import { articleSlugs } from "@/lib/content/server";
import { langUrl } from "@/lib/seo";

// Public pages only. Pages that need a sign-in, and /admin and /api, are not listed (see robots.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/eligibility", "/fees", "/prepare", "/guide", "/help", "/extras", "/status", "/official", "/privacy", "/terms", "/articles", ...(await articleSlugs()).map((slug) => `/articles/${slug}`)];
  // every page is listed once per language (?lang=), each entry pointing at all its language versions (hreflang)
  return pages.flatMap((p) => LANG_CODES.map((l) => ({ url: langUrl(p || "/", l), changeFrequency: (p === "" ? "weekly" : "monthly") as "weekly" | "monthly", priority: p === "" ? 1 : 0.6,
    alternates: { languages: Object.fromEntries(LANG_CODES.map((x) => [LANGS[x].htmlLang, langUrl(p || "/", x)])) } })));
}
