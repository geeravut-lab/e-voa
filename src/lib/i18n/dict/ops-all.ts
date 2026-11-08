import type { Dict } from "./en";
import type { ExtraLang } from "@/lib/content/types";
import { opsAr } from "./ops-ar";
import { opsHi } from "./ops-hi";
import { opsJa } from "./ops-ja";
import { opsKo } from "./ops-ko";
import { opsRu } from "./ops-ru";
import { opsZhTW } from "./ops-zh-TW";
// The queue (Ops console) texts of the six later languages; see content/lang for the toolkit texts.
export const OPS: Partial<Record<ExtraLang, Partial<Dict>>> = { hi: opsHi, ar: opsAr, ru: opsRu, ko: opsKo, ja: opsJa, "zh-TW": opsZhTW };
