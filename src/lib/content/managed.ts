// FAQ and news edited in the back office. Pure helpers first (no database), the loaders below.
import type { Lang } from "@/lib/i18n/langs";

export const CONTENT_LANGS = ["en", "th", "zh-CN"] as const;           // the languages staff write; every other language shows the English text
export type ContentText = Partial<Record<(typeof CONTENT_LANGS)[number], string>>;
export const TITLE_MAX = 200, BODY_MAX = 4000;

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
