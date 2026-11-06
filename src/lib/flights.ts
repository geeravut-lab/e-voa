import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Flight lookup: type the flight number and date, get the airline, the Thai airport and the landing time. The provider is a plain HTTP endpoint
// (FLIGHT_API_URL, optional FLIGHT_API_KEY); tools/mock-partners answers /flights/lookup the same way. No provider → the form asks for the details.
export type FlightInfo = { flight: string; airlineId: number | null; airlineName: string; arrivalAirportId: number | null; arrivalAirportName: string | null; arrivalTime: string; originCountry: string | null };

const AIRPORT_WORDS: Record<string, string> = { BKK: "suvarnabhumi", DMK: "don mueang", HKT: "phuket", CNX: "chiang mai" };

export const flightLookupConfigured = () => Boolean(process.env.FLIGHT_API_URL);

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

export async function lookupFlight(flightRaw: string, date: string): Promise<FlightInfo | null> {
  const flight = parseFlightNumber(flightRaw);
  const base = process.env.FLIGHT_API_URL;
  if (!flight || !base || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/flights/lookup?${new URLSearchParams({ flight, date })}`, { headers: process.env.FLIGHT_API_KEY ? { "x-api-key": process.env.FLIGHT_API_KEY } : {}, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const db = createAdminClient();
    const [a, b] = await Promise.all([db.from("master_data").select("id, label").eq("name", "arrivalAirport"), db.from("master_data").select("id, label").eq("name", "airlines")]);
    return mapFlight(await res.json(), a.data ?? [], b.data ?? []);
  } catch (e) { console.error("[flights] lookup failed", (e as Error).message); return null; }
}
