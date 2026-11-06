import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { envValue } from "@/lib/env";

// Flight lookup: type the flight number and date, get the airline, the Thai airport and the landing time. The provider is a plain HTTP endpoint
// (FLIGHT_API_URL, optional FLIGHT_API_KEY); tools/mock-partners answers /flights/lookup the same way. No provider → the form asks for the details.
export type FlightInfo = { flight: string; airlineId: number | null; airlineName: string; arrivalAirportId: number | null; arrivalAirportName: string | null; arrivalTime: string; originCountry: string | null };

const AIRPORT_WORDS: Record<string, string> = { BKK: "suvarnabhumi", DMK: "don mueang", HKT: "phuket", CNX: "chiang mai" };

export const flightLookupConfigured = () => Boolean(envValue("FLIGHT_API_URL"));

export function parseFlightNumber(raw: string): string | null {
  const f = raw.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{2}\d{1,4}$/.test(f) ? f : null;
}

/** Maps the provider's airport/airline codes to the ids Immigration uses (master data). Unknown airports stay null so the form asks the traveler. */
export function mapFlight(raw: { flight?: string; airline?: { iata?: string; name?: string }; origin?: { country?: string }; arrival?: { iata?: string; scheduledLocal?: string } },
  airports: { id: number; label: string }[], airlines: { id: number; label: string }[]): FlightInfo | null {
  if (!raw.flight || !raw.arrival?.scheduledLocal || !/^\d{2}:\d{2}$/.test(raw.arrival.scheduledLocal)) return null;
  const word = AIRPORT_WORDS[(raw.arrival.iata ?? "").toUpperCase()];
  const airport = word ? airports.find((a) => a.label.toLowerCase().includes(word)) : undefined;
  const isThai = (raw.airline?.iata ?? "").toUpperCase() === "TG";
  const airline = isThai ? airlines.find((a) => /thai/i.test(a.label)) : airlines.find((a) => /other/i.test(a.label));      // Immigration's list only separates Thai Airways from the rest
  return { flight: raw.flight, airlineId: airline?.id ?? null, airlineName: raw.airline?.name ?? "", arrivalAirportId: airport?.id ?? null, arrivalAirportName: airport?.label ?? null, arrivalTime: raw.arrival.scheduledLocal, originCountry: raw.origin?.country ?? null };
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
    const [a, b] = await Promise.all([db.from("master_data").select("id, label").eq("name", "arrivalAirport"), db.from("master_data").select("id, label").eq("name", "airlines")]);
    return mapFlight(raw, a.data ?? [], b.data ?? []);
  } catch (e) { console.error("[flights] lookup failed", (e as Error).message); return null; }
}
