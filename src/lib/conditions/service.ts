import "server-only";
import { envValue } from "@/lib/env";
import { emptyReadings, parseReadings, type Readings } from "./rules";
import type { Place } from "./places";
import { parseStations, pickStation, type Station, type StationPick } from "./air4thai";
import { parseCapAlert, parseCapFeed, warningsFor, type Warning } from "./tmd";

/**
 * Live weather and air quality (PM2.5) for a place, from Open-Meteo (open data; modelled values for a grid cell, updated about hourly).
 * LICENCE: the free servers are for non-commercial use. A commercial service must use a paid plan: put its key in OPEN_METEO_API_KEY and the
 * "customer-" servers are used (or set OPEN_METEO_URL / OPEN_METEO_AQ_URL to your own). Credit "Weather data by Open-Meteo.com" wherever the data is shown.
 */
const forecastBase = () => envValue("OPEN_METEO_URL") || (envValue("OPEN_METEO_API_KEY") ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com");
const airBase = () => envValue("OPEN_METEO_AQ_URL") || (envValue("OPEN_METEO_API_KEY") ? "https://customer-air-quality-api.open-meteo.com" : "https://air-quality-api.open-meteo.com");
const key = () => (envValue("OPEN_METEO_API_KEY") ? `&apikey=${encodeURIComponent(envValue("OPEN_METEO_API_KEY"))}` : "");

export const SOURCE = "Weather data by Open-Meteo.com";
/** Official Thai sources. Air4Thai: its HTTPS certificate chain is incomplete (checked 8 Nov 2026), so the public read-only JSON is fetched over plain HTTP and every value is range-checked; set AIR4THAI_URL=off to turn it off. */
const air4thaiUrl = () => envValue("AIR4THAI_URL") || "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php";
const tmdUrl = () => envValue("TMD_CAP_URL") || "https://www.tmd.go.th/api/xml/CAP";
export type AirInfo = { source: "air4thai"; station: { name: string; area: string; distanceKm: number; at: string | null; thaiAqi: number | null } } | { source: "model" };
export type Conditions = { ok: true; place: string; readings: Readings; fetchedAt: string; air: AirInfo; warnings: Warning[]; warningsKnown: boolean } | { ok: false; error: "unavailable" };

const g = globalThis as unknown as { __evoaConditions?: Map<string, { at: number; value: Conditions }> };
const cache = (g.__evoaConditions ??= new Map());
const TTL_MS = 10 * 60_000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store", headers: { Accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const shared = globalThis as unknown as { __evoaOfficial?: { stations?: { at: number; list: Station[] }; warnings?: { at: number; list: Warning[] | null } } };
const official = (shared.__evoaOfficial ??= {});
async function getText(url: string, ms = 8_000): Promise<string | null> {
  try { const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-store" }); return res.ok ? await res.text() : null; } catch { return null; }
}
/** All Air4Thai stations (one 130 KB answer for the whole country), kept for 10 minutes. An empty list when it cannot be read. */
export async function loadStations(): Promise<Station[]> {
  if (/^(off|none)$/i.test(air4thaiUrl())) return [];
  const hit = official.stations; if (hit && Date.now() - hit.at < TTL_MS) return hit.list;
  const text = await getText(air4thaiUrl(), 10_000);
  let list: Station[] = []; try { list = text ? parseStations(JSON.parse(text)) : []; } catch { list = []; }
  if (list.length) official.stations = { at: Date.now(), list }; else if (hit) return hit.list;           // keep the last good copy when a refresh fails
  return list;
}
/** The department's current public warnings (the feed, then each alert document). null = could not be read, [] = none. Kept for 10 minutes. */
export async function loadWarnings(): Promise<Warning[] | null> {
  if (/^(off|none)$/i.test(tmdUrl())) return null;
  const hit = official.warnings; if (hit && Date.now() - hit.at < TTL_MS) return hit.list;
  const feed = await getText(tmdUrl());
  if (!feed) return hit?.list ?? null;
  const origin = (() => { try { const u = new URL(tmdUrl()); return u.hostname === "www.tmd.go.th" ? "" : u.origin; } catch { return ""; } })();
  const items = parseCapFeed(feed, origin).slice(0, 6);
  const docs = await Promise.all(items.map(async (i) => { const x = await getText(i.link); return x ? parseCapAlert(x, i.link) : null; }));
  const list = docs.filter((w): w is Warning => !!w);
  official.warnings = { at: Date.now(), list }; return list;
}

/** Asks the services for one place. Kept for 10 minutes. If neither answers, or nothing usable comes back, the answer is "unavailable": nothing is guessed. */
export async function fetchConditions(p: Place): Promise<Conditions> {
  const hit = cache.get(p.slug); if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const at = `latitude=${p.lat}&longitude=${p.lon}&timezone=Asia%2FBangkok${key()}`;
  const [f, a] = await Promise.all([
    getJson(`${forecastBase()}/v1/forecast?${at}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,precipitation_probability_max,uv_index_max&forecast_days=1`),
    getJson(`${airBase()}/v1/air-quality?${at}&current=pm2_5,pm10,us_aqi,uv_index`),
  ]);
  const readings = f || a ? parseReadings(f, a) : emptyReadings();
  // official data: a recent measuring station nearby replaces the modelled PM2.5; the department's warnings are matched by province
  const [stations, all] = await Promise.all([loadStations(), loadWarnings()]);
  const pick: StationPick | null = pickStation(stations, p, new Date());
  let air: AirInfo = { source: "model" };
  if (pick) { readings.pm25 = pick.station.pm25; if (pick.station.pm10 !== null) readings.pm10 = pick.station.pm10; air = { source: "air4thai", station: { name: pick.station.nameEN || pick.station.nameTH, area: pick.station.areaEN, distanceKm: pick.distanceKm, at: pick.station.at, thaiAqi: pick.station.thaiAqi } }; }
  const warnings = all ? warningsFor(p, all, new Date()) : [];
  const usable = readings.tempC !== null || readings.pm25 !== null || warnings.length > 0;
  const value: Conditions = usable ? { ok: true, place: p.slug, readings, fetchedAt: new Date().toISOString(), air, warnings, warningsKnown: all !== null } : { ok: false, error: "unavailable" };
  if (usable) cache.set(p.slug, { at: Date.now(), value }); else if (!hit) cache.delete(p.slug);
  return value;
}
