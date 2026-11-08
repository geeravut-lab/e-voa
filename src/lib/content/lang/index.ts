import type { ExtraLang } from "../types";
import type { PackA, PackB } from "../lang-pack";
import { arA } from "./ar-a";
import { arB } from "./ar-b";
import { hiA } from "./hi-a";
import { hiB } from "./hi-b";
import { jaA } from "./ja-a";
import { jaB } from "./ja-b";
import { koA } from "./ko-a";
import { koB } from "./ko-b";
import { ruA } from "./ru-a";
import { ruB } from "./ru-b";
import { zhTWA } from "./zh-TW-a";
import { zhTWB } from "./zh-TW-b";
// One pack per language (A: toolkit, rental, weather advice; B: incident guides, family check-in). A language without a pack shows English (see forLang).
export const PACK_A: Partial<Record<ExtraLang, PackA>> = { hi: hiA, ar: arA, ru: ruA, ko: koA, ja: jaA, "zh-TW": zhTWA };
export const PACK_B: Partial<Record<ExtraLang, PackB>> = { hi: hiB, ar: arB, ru: ruB, ko: koB, ja: jaB, "zh-TW": zhTWB };
