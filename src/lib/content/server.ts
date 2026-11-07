import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { FAQ, type Faq } from "./faq";
import { forLang } from "./types";
import { pickText, parseSections, type ManagedItem } from "./managed";
import { ARTICLES, type Article } from "./articles";
import type { Lang } from "@/lib/i18n/langs";

/**
 * The FAQ shown to visitors: the questions written in the back office when there are any published, otherwise the ones built into the code.
 * Fails open: if the database cannot be read, the built-in questions are used and the page still works.
 */
export async function loadFaq(lang: Lang | string): Promise<Faq[]> {
  const builtin = () => forLang(FAQ, lang as Lang);
  if (!hasServiceRole()) return builtin();
  try {
    const { data, error } = await createAdminClient().from("content_items").select("title, body").eq("kind", "faq").eq("published", true).order("sort", { ascending: true }).order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({ q: pickText(r.title, lang), a: pickText(r.body, lang) })).filter((r) => r.q && r.a);
    return rows.length ? rows : builtin();
  } catch (e) { console.error("[content] faq read failed", (e as Error).message); return builtin(); }
}

/** Published news, newest first. */
export async function loadNews(lang: Lang | string, limit = 50): Promise<ManagedItem[]> {
  if (!hasServiceRole()) return [];
  try {
    const { data, error } = await createAdminClient().from("content_items").select("id, title, body, pinned, published_at").eq("kind", "news").eq("published", true).order("published_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, title: pickText(r.title, lang), body: pickText(r.body, lang), pinned: r.pinned, publishedAt: r.published_at })).filter((r) => r.title);
  } catch (e) { console.error("[content] news read failed", (e as Error).message); return []; }
}
/** The newest pinned item (the home page banner), if any. */
export async function pinnedNews(lang: Lang | string): Promise<ManagedItem | null> { return (await loadNews(lang, 20)).find((n) => n.pinned) ?? null; }

/**
 * Travel articles: the ones written in the back office when at least one is published, otherwise the built-in ones. Fails open like the FAQ.
 * A managed article shows the reader's language, or English where that language is not written yet.
 */
export async function loadArticles(lang: Lang | string): Promise<Article[]> {
  const builtin = () => forLang(ARTICLES, lang as Lang);
  if (!hasServiceRole()) return builtin();
  try {
    const { data, error } = await createAdminClient().from("content_items").select("slug, title, summary, body, published_at").eq("kind", "article").eq("published", true).not("slug", "is", null).order("published_at", { ascending: false }).limit(200);
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({ slug: r.slug as string, date: (r.published_at as string | null)?.slice(0, 10) ?? "", title: pickText(r.title, lang), summary: pickText(r.summary, lang), body: parseSections(pickText(r.body, lang)) })).filter((a) => a.slug && a.title && a.body.length);
    return rows.length ? rows : builtin();
  } catch (e) { console.error("[content] articles read failed", (e as Error).message); return builtin(); }
}
export async function loadArticle(slug: string, lang: Lang | string): Promise<Article | null> { return (await loadArticles(lang)).find((a) => a.slug === slug) ?? null; }
/** Every address that must be in the sitemap (English list is enough: the slug is the same in every language). */
export async function articleSlugs(): Promise<string[]> { return (await loadArticles("en")).map((a) => a.slug); }

