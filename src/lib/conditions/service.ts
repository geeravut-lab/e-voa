import "server-only";
import { envValue } from "@/lib/env";
import { emptyReadings, parseReadings, type Readings } from "./rules";
import type { Place } from "./places";

/**
 * Live weather and air quality (PM2.5) for a place, from Open-Meteo (open data; modelled values for a grid cell, updated about hourly).
 * LICENCE: the free servers are for non-commercial use. A commercial service must use a paid plan: put its key in OPEN_METEO_API_KEY and the
 * "customer-" servers are used (or set OPEN_METEO_URL / OPEN_METEO_AQ_URL to your own). Credit "Weather data by Open-Meteo.com" wherever the data is shown.
 */
const forecastBase = () => envValue("OPEN_METEO_URL") || (envValue("OPEN_METEO_API_KEY") ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com");
const airBase = () => envValue("OPEN_METEO_AQ_URL") || (envValue("OPEN_METEO_API_KEY") ? "https://customer-air-quality-api.open-meteo.com" : "https://air-quality-api.open-meteo.com");
const key = () => (envValue("OPEN_METEO_API_KEY") ? `&apikey=${encodeURIComponent(envValue("OPEN_METEO_API_KEY"))}` : "");

export const SOURCE = "Weather data by Open-Meteo.com";
export type Conditions = { ok: true; place: string; readings: Readings; fetchedAt: string } | { ok: false; error: "unavailable" };

const g = globalThis as unknown as { __evoaConditions?: Map<string, { at: number; value: Conditions }> };
const cache = (g.__evoaConditions ??= new Map());
const TTL_MS = 10 * 60_000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store", headers: { Accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

/** Asks both services for one place. Kept for 10 minutes. If neither answers, or nothing usable comes back, the answer is "unavailable": nothing is guessed. */
export async function fetchConditions(p: Place): Promise<Conditions> {
  const hit = cache.get(p.slug); if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const at = `latitude=${p.lat}&longitude=${p.lon}&timezone=Asia%2FBangkok${key()}`;
  const [f, a] = await Promise.all([
    getJson(`${forecastBase()}/v1/forecast?${at}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,precipitation_probability_max,uv_index_max&forecast_days=1`),
    getJson(`${airBase()}/v1/air-quality?${at}&current=pm2_5,pm10,us_aqi,uv_index`),
  ]);
  const readings = f || a ? parseReadings(f, a) : emptyReadings();
  const usable = readings.tempC !== null || readings.pm25 !== null;
  const value: Conditions = usable ? { ok: true, place: p.slug, readings, fetchedAt: new Date().toISOString() } : { ok: false, error: "unavailable" };
  if (usable) cache.set(p.slug, { at: Date.now(), value }); else if (!hit) cache.delete(p.slug);
  return value;
}
