import { en, type Dict } from "./en";
import { th } from "./th";
import { zhCN } from "./zh-CN";
import type { Lang } from "../langs";

export type { Dict };
export const DICTS: Record<Lang, Dict> = { en, th, "zh-CN": zhCN };
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
