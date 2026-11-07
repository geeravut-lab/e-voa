// FAQ and news edited in the back office. Pure helpers first (no database), the loaders below.
import type { Lang } from "@/lib/i18n/langs";
import type { Section } from "./types";

export const CONTENT_LANGS = ["en", "th", "zh-CN"] as const;           // the languages staff write; every other language shows the English text
export type ContentText = Partial<Record<(typeof CONTENT_LANGS)[number], string>>;
export const TITLE_MAX = 200, BODY_MAX = 4000, ARTICLE_MAX = 20000, SUMMARY_MAX = 300;

/** Reads a text map in the reader's language, falling back to English, then to anything that exists. */
export function pickText(m: unknown, lang: Lang | string): string {
  const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>, s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : "");
  return s(lang) || s("en") || CONTENT_LANGS.map(s).find(Boolean) || "";
}

/** Cleans what staff typed: trims, drops control characters (keeps line breaks), limits the length. Empty languages are left out. */
export function cleanTexts(raw: Record<string, unknown>, max: number): ContentText {
  const out: ContentText = {};
  for (const l of CONTENT_LANGS) {
    // eslint-disable-next-line no-control-regex
    const v = String(raw[l] ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f​-‏‪-‮⁦-⁩]/g, "").trim().slice(0, max);
    if (v) out[l] = v;
  }
  return out;
}

export type ManagedItem = { id: string; title: string; body: string; pinned: boolean; publishedAt: string | null };

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const validSlug = (s: string) => SLUG_RE.test(s) && s.length >= 3 && s.length <= 80;

/**
 * Article text → sections. A line that starts with "## " is a section heading; a blank line separates paragraphs. Text before the first heading becomes an untitled section.
 * Plain text only: nothing here is ever treated as HTML.
 */
export function parseSections(text: string): Section[] {
  const out: Section[] = []; let cur: Section | null = null, para: string[] = [];
  const flush = () => { if (para.length && cur) cur.p.push(para.join(" ")); para = []; };
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim(), h = /^##\s+(.+)$/.exec(line);
    if (h) { flush(); cur = { h: h[1].trim(), p: [] }; out.push(cur); continue; }
    if (!line) { flush(); continue; }
    if (!cur) { cur = { h: "", p: [] }; out.push(cur); }
    para.push(line);
  }
  flush();
  return out.filter((x) => x.h || x.p.length);
}
/** The reverse (used to put the built-in articles into the editor). */
export const sectionsToText = (sections: Section[]) => sections.map((s) => [s.h ? `## ${s.h}` : "", ...s.p.flatMap((p) => ["", p])].filter((x, i) => x !== "" || i > 0).join("\n").trim()).join("\n\n");

