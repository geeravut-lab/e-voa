import "server-only";
import { getSetting } from "@/lib/settings";
import { LANG_CODES, type Lang } from "@/lib/i18n/langs";

// What only the airport and Thai Immigration can say (which counter or lane takes an E-VOA, where it is, opening hours) is written by the admin per airport and language, never guessed.
export const AIRPORT_CODES = ["BKK", "DMK", "HKT", "CNX"] as const;
export type AirportCode = (typeof AIRPORT_CODES)[number];
export type AirportNotes = Partial<Record<AirportCode, Partial<Record<Lang, string>>>>;

export function parseAirportNotes(v: unknown): AirportNotes {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; const out: AirportNotes = {};
  for (const code of AIRPORT_CODES) {
    const per = (o[code] && typeof o[code] === "object" ? o[code] : {}) as Record<string, unknown>; const row: Partial<Record<Lang, string>> = {};
    for (const l of LANG_CODES) { const t = typeof per[l] === "string" ? (per[l] as string).trim().slice(0, 1500) : ""; if (t) row[l] = t; }
    if (Object.keys(row).length) out[code] = row;
  }
  return out;
}
export const loadAirportNotes = async () => parseAirportNotes(await getSetting<unknown>("airport_notes", {}));
