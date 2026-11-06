import "server-only";
import { cookies, headers } from "next/headers";
import { applyBrandName, type Brand } from "@/lib/brand/brand";
import { loadBrand } from "@/lib/brand/server";
import { DICTS, type Dict } from "./dict";
import { isLang, LANG_COOKIE, pickLang, type Lang } from "./langs";

/** Language order: cookie (explicit choice) → browser's Accept-Language → English. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return pickLang((await headers()).get("accept-language"));
}

/** One language's dictionary with the platform name swapped for the admin-chosen one. Only this language is sent to the browser. */
export async function getT(): Promise<{ lang: Lang; t: Dict; brandName: string; brand: Brand }> {
  const [lang, brand] = await Promise.all([getLang(), loadBrand()]);
  const base = DICTS[lang];
  const t = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, applyBrandName(v, brand.name)])) as Dict;
  return { lang, t, brandName: brand.name, brand };
}
