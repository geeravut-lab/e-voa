import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { adbToRaw, flightProviderOf, mapFlight } from "@/lib/flights";

const airports = [{ id: 1, label: "Suvarnabhumi International Airport" }, { id: 2, label: "Phuket International Airport" }];
const airlines = [{ id: 1, label: "Thai Airways" }, { id: 2, label: "Other" }];
// Shape of AeroDataBox "flight by number and date" (one entry per leg)
const sample = [{ number: "TG 316", airline: { name: "Thai Airways International", iata: "TG", icao: "THA" },
  departure: { airport: { iata: "DEL", countryCode: "IN", name: "Delhi" }, scheduledTime: { utc: "2026-11-17 22:10Z", local: "2026-11-18 03:40+05:30" } },
  arrival: { airport: { iata: "BKK", countryCode: "TH", name: "Bangkok Suvarnabhumi" }, scheduledTime: { utc: "2026-11-17 21:05Z", local: "2026-11-18 04:05+07:00" } } }];

describe("flight providers", () => {
  it("picks the provider from the address", () => {
    expect(flightProviderOf("https://aerodatabox.p.rapidapi.com")).toBe("rapidapi");
    expect(flightProviderOf("https://prod.api.market/api/v1/aedbx/aerodatabox")).toBe("apimarket");
    expect(flightProviderOf("http://localhost:4010")).toBe("simulator");
    expect(flightProviderOf("not a url")).toBe("simulator");
  });
  it("reads the Thai landing leg of an AeroDataBox answer and maps it to Immigration's ids", () => {
    const raw = adbToRaw(sample, "TG316")!;
    expect(raw).toMatchObject({ flight: "TG316", arrival: { iata: "BKK", scheduledLocal: "04:05" }, origin: { country: "IN" } });
    expect(mapFlight(raw, airports, airlines)).toMatchObject({ flight: "TG316", arrivalAirportId: 1, airlineId: 1, arrivalTime: "04:05", originCountry: "IN" });
  });
  it("gives nothing for a flight that does not land in Thailand, an empty list or garbage", () => {
    expect(adbToRaw([{ ...sample[0], arrival: { airport: { iata: "SIN", countryCode: "SG" }, scheduledTime: { local: "2026-11-18 04:05+08:00" } } }], "TG316")).toBeNull();
    expect(adbToRaw([], "TG316")).toBeNull(); expect(adbToRaw({ message: "error" }, "TG316")).toBeNull(); expect(adbToRaw(null, "TG316")).toBeNull();
  });
});
