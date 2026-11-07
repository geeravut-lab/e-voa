import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env";
import { FAQ, type Faq } from "./faq";
import { forLang } from "./types";
import { pickText, type ManagedItem } from "./managed";
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
