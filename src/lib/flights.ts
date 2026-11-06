import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { envValue } from "@/lib/env";

// Flight lookup: type the flight number and date, get the airline, the Thai airport and the landing time. The provider is a plain HTTP endpoint
// (FLIGHT_API_URL, optional FLIGHT_API_KEY); tools/mock-partners answers /flights/lookup the same way. No provider → the form asks for the details.
export type FlightInfo = { flight: string; airlineId: number | null; airlineName: string; arrivalAirportId: number | null; arrivalAirportName: string | null; arrivalTime: string; originCountry: string | null; originCountryId: number | null };

const AIRPORT_WORDS: Record<string, string> = { BKK: "suvarnabhumi", DMK: "don mueang", HKT: "phuket", CNX: "chiang mai" };

export const flightLookupConfigured = () => Boolean(envValue("FLIGHT_API_URL"));

export function parseFlightNumber(raw: string): string | null {
  const f = raw.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{2}\d{1,4}$/.test(f) ? f : null;
}

// ISO 3166 two-letter → three-letter codes of the countries most flights to Thailand start in (the master list carries the three-letter code).
const ISO3: Record<string, string> = { SG: "SGP", IN: "IND", CN: "CHN", RU: "RUS", MY: "MYS", JP: "JPN", KR: "KOR", TW: "TWN", HK: "HKG", MO: "MAC", AU: "AUS", NZ: "NZL", GB: "GBR", US: "USA", CA: "CAN", DE: "DEU", FR: "FRA", IT: "ITA", ES: "ESP", NL: "NLD", CH: "CHE", SE: "SWE", FI: "FIN", DK: "DNK", NO: "NOR", PL: "POL", CZ: "CZE", AT: "AUT", BE: "BEL", GR: "GRC", UA: "UKR", AE: "ARE", QA: "QAT", SA: "SAU", BH: "BHR", KW: "KWT", OM: "OMN", TR: "TUR", IL: "ISR", EG: "EGY", ET: "ETH", KE: "KEN", ZA: "ZAF", VN: "VNM", ID: "IDN", PH: "PHL", KH: "KHM", LA: "LAO", MM: "MMR", LK: "LKA", NP: "NPL", BD: "BGD", PK: "PAK", KZ: "KAZ", UZ: "UZB", BR: "BRA", MX: "MEX", BT: "BTN", MV: "MDV", MN: "MNG", BN: "BRN" };
const NAME_ALIASES: Record<string, string[]> = { US: ["UNITED STATES", "USA", "AMERICA"], GB: ["UNITED KINGDOM", "GREAT BRITAIN", "BRITAIN"], KR: ["SOUTH KOREA", "KOREA, SOUTH", "KOREA (SOUTH)", "KOREA, REPUBLIC", "REPUBLIC OF KOREA"], RU: ["RUSSIA", "RUSSIAN FEDERATION"], VN: ["VIETNAM", "VIET NAM"], AE: ["UNITED ARAB EMIRATES", "UAE"], TW: ["TAIWAN"], LA: ["LAOS", "LAO PEOPLE"], CN: ["CHINA"], HK: ["HONG KONG"] };
const norm = (x: string) => x.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ,()]/g, " ").replace(/\s+/g, " ").trim();

/** The country the flight started in → the id in the nationality list: by three-letter code when the list has one, else by the country's name. */
export function matchCountry(alpha2: string | undefined, countries: { id: number; label: string; extra?: unknown }[]): number | null {
  const c = (alpha2 ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || countries.length === 0) return null;
  const a3 = ISO3[c];
  const byCode = a3 ? countries.find((x) => String((x.extra as { CountryCode?: string } | undefined)?.CountryCode ?? "").toUpperCase() === a3) : undefined;
  if (byCode) return byCode.id;
  let en: string | undefined; try { en = new Intl.DisplayNames(["en"], { type: "region" }).of(c); } catch { en = undefined; }
  const names = [en, ...(NAME_ALIASES[c] ?? [])].filter((n): n is string => !!n).map(norm);
  const hit = countries.find((x) => names.includes(norm(x.label))) ?? countries.find((x) => names.some((n) => norm(x.label).startsWith(n)));
  return hit?.id ?? null;
}

const STOP = new Set(["AIRWAYS", "AIRLINES", "AIRLINE", "AIR", "INTERNATIONAL", "THE", "CO", "LTD", "LIMITED", "PCL", "PUBLIC", "COMPANY"]);
const core = (x: string) => norm(x).split(" ").filter((w) => w && !STOP.has(w)).join(" ");

/** Immigration's list may name the airline, or may only separate Thai Airways from "Others": try the name first, then those two. */
export function matchAirline(name: string | undefined, iata: string | undefined, airlines: { id: number; label: string }[]): number | null {
  const n = core(name ?? "");
  const named = n ? airlines.find((a) => core(a.label) === n) ?? airlines.find((a) => core(a.label) && (core(a.label).includes(n) || n.includes(core(a.label)))) : undefined;
  const isThai = (iata ?? "").toUpperCase() === "TG";
  const fallback = named ?? (isThai ? airlines.find((a) => /thai/i.test(a.label)) : airlines.find((a) => /other/i.test(a.label)));
  return fallback?.id ?? null;
}

/** Maps the provider's airport/airline/country codes to the ids Immigration uses (master data). Anything that cannot be matched stays null so the form asks the traveler. */
export function mapFlight(raw: { flight?: string; airline?: { iata?: string; name?: string }; origin?: { country?: string }; arrival?: { iata?: string; scheduledLocal?: string } },
  airports: { id: number; label: string }[], airlines: { id: number; label: string }[], countries: { id: number; label: string; extra?: unknown }[] = []): FlightInfo | null {
  if (!raw.flight || !raw.arrival?.scheduledLocal || !/^\d{2}:\d{2}$/.test(raw.arrival.scheduledLocal)) return null;
  const word = AIRPORT_WORDS[(raw.arrival.iata ?? "").toUpperCase()];
  const airport = word ? airports.find((a) => a.label.toLowerCase().includes(word)) : undefined;
  return { flight: raw.flight, airlineId: matchAirline(raw.airline?.name, raw.airline?.iata, airlines), airlineName: raw.airline?.name ?? "", arrivalAirportId: airport?.id ?? null, arrivalAirportName: airport?.label ?? null, arrivalTime: raw.arrival.scheduledLocal, originCountry: raw.origin?.country ?? null, originCountryId: matchCountry(raw.origin?.country, countries) };
}

// ---- providers --------------------------------------------------------------------------------------------------------------
// FLIGHT_API_URL decides which one is used:
//   https://aerodatabox.p.rapidapi.com                          AeroDataBox through RapidAPI   (FLIGHT_API_KEY = your X-RapidAPI-Key)
//   https://prod.api.market/api/v1/aedbx/aerodatabox            AeroDataBox through API.Market (FLIGHT_API_KEY = your x-api-market-key)
//   any other address (AeroDataBox direct)                       AeroDataBox format; the key goes in the header named by FLIGHT_API_KEY_HEADER (default x-api-key)
//   http://localhost:4010                                       the simulator (own format; key sent as x-api-key)
export type FlightProvider = "rapidapi" | "apimarket" | "direct" | "simulator";
export const flightProviderOf = (base: string): FlightProvider => { try { const h = new URL(base).host; return /rapidapi\.com$/.test(h) ? "rapidapi" : /api\.market$/.test(h) ? "apimarket" : /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h) ? "simulator" : "direct"; } catch { return "simulator"; } };

type AdbAirport = { iata?: string; countryCode?: string; name?: string };
type AdbFlight = { number?: string; airline?: { iata?: string; name?: string }; departure?: { airport?: AdbAirport }; arrival?: { airport?: AdbAirport; scheduledTime?: { local?: string } } };

/** AeroDataBox answers a list (one entry per leg). We want the leg that lands in Thailand; its scheduled LOCAL time is the Thai wall-clock time ("2026-11-18 04:05+07:00"). */
export function adbToRaw(list: unknown, requested: string): Parameters<typeof mapFlight>[0] | null {
  if (!Array.isArray(list)) return null;
  const leg = (list as AdbFlight[]).find((f) => (f.arrival?.airport?.countryCode ?? "").toUpperCase() === "TH");
  const time = leg?.arrival?.scheduledTime?.local?.match(/[T\s](\d{2}:\d{2})/)?.[1];
  if (!leg || !time) return null;
  return { flight: parseFlightNumber(leg.number ?? "") ?? requested, airline: { iata: leg.airline?.iata, name: leg.airline?.name }, origin: { country: leg.departure?.airport?.countryCode }, arrival: { iata: leg.arrival?.airport?.iata, scheduledLocal: time } };
}

export async function lookupFlight(flightRaw: string, date: string): Promise<FlightInfo | null> {
  const flight = parseFlightNumber(flightRaw);
  const base = envValue("FLIGHT_API_URL").replace(/\/$/, "");
  const key = envValue("FLIGHT_API_KEY");
  if (!flight || !base || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    const kind = flightProviderOf(base);
    const url = kind === "simulator" ? `${base}/flights/lookup?${new URLSearchParams({ flight, date })}`
      : `${base}/flights/number/${flight}/${date}?${new URLSearchParams({ dateLocalRole: "Arrival", withAircraftImage: "false", withLocation: "false" })}`;
    const headers: Record<string, string> = kind === "rapidapi" ? { "X-RapidAPI-Key": key, "X-RapidAPI-Host": new URL(base).host } : kind === "apimarket" ? { "x-api-market-key": key } : kind === "direct" ? { [envValue("FLIGHT_API_KEY_HEADER") || "x-api-key"]: key } : key ? { "x-api-key": key } : {};
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) { if (res.status !== 404) console.error("[flights] provider answered", res.status); return null; }
    const json = await res.json();
    const raw = kind === "simulator" ? json : adbToRaw(json, flight);
    if (!raw) return null;
    const db = createAdminClient();
    const [a, b, c] = await Promise.all([db.from("master_data").select("id, label").eq("name", "arrivalAirport"), db.from("master_data").select("id, label").eq("name", "airlines"), db.from("master_data").select("id, label, extra").eq("name", "nationality")]);
    return mapFlight(raw, a.data ?? [], b.data ?? [], c.data ?? []);
  } catch (e) { console.error("[flights] lookup failed", (e as Error).message); return null; }
}
