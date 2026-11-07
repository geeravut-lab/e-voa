// Air4Thai (Pollution Control Department): measured air quality at ground stations. PURE parsing and choosing.
// Verified against the real service on 8 Nov 2026: {"stations":[{"stationID","nameTH","nameEN","areaTH","areaEN","stationType","lat","long","AQILast":{"date","time","PM25":{"color_id","aqi","value"},"PM10":{…},"AQI":{"color_id","aqi","param"}}}]}
// Missing values are the text "-1". All numbers are strings. Times are Thai local time.
import { distanceKm } from "./places";

export type Station = { id: string; nameEN: string; nameTH: string; areaEN: string; lat: number; lon: number; type: string; at: string | null; pm25: number | null; pm10: number | null; thaiAqi: number | null; aqiLevel: number | null };

const num = (v: unknown): number | null => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; return Number.isFinite(n) && n >= 0 ? n : null; };   // "-1" means "no reading"
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Every station of the answer that has a position. A damaged entry is skipped, never a crash. */
export function parseStations(json: unknown): Station[] {
  const list = (obj(json).stations ?? []) as unknown[];
  if (!Array.isArray(list)) return [];
  const out: Station[] = [];
  for (const raw of list) {
    const s = obj(raw), last = obj(s.AQILast), lat = Number(s.lat), lon = Number(s.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 5 || lat > 21 || lon < 97 || lon > 106) continue;
    const date = typeof last.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(last.date) ? last.date : null, time = typeof last.time === "string" && /^\d{2}:\d{2}/.test(last.time) ? last.time.slice(0, 5) : null;
    const aqi = obj(last.AQI), pm25 = obj(last.PM25), pm10 = obj(last.PM10);
    out.push({ id: String(s.stationID ?? ""), nameEN: String(s.nameEN ?? "").slice(0, 120), nameTH: String(s.nameTH ?? "").slice(0, 120), areaEN: String(s.areaEN ?? "").slice(0, 160), lat, lon, type: String(s.stationType ?? ""),
      at: date && time ? `${date}T${time}` : null, pm25: (v => (v !== null && v < 2000 ? v : null))(num(pm25.value)), pm10: num(pm10.value), thaiAqi: num(aqi.aqi), aqiLevel: num(aqi.color_id) });
  }
  return out;
}
/** Thai local time "2026-11-08T03:00" → minutes before `now`. */
export const ageMinutes = (at: string | null, now: Date) => (at ? Math.round((now.getTime() - Date.parse(`${at}:00+07:00`)) / 60_000) : null);

export type StationPick = { station: Station; distanceKm: number; ageMin: number };
/** The nearest station that has a recent PM2.5 reading. Too far or too old means "no station": the caller then uses the modelled value and says so. */
export function pickStation(stations: Station[], at: { lat: number; lon: number }, now: Date, opt: { maxKm?: number; maxAgeMin?: number } = {}): StationPick | null {
  const maxKm = opt.maxKm ?? 40, maxAge = opt.maxAgeMin ?? 240;
  let best: StationPick | null = null;
  for (const s of stations) {
    if (s.pm25 === null) continue;
    const age = ageMinutes(s.at, now); if (age === null || age > maxAge || age < -30) continue;
    const d = distanceKm(at, s); if (d > maxKm) continue;
    if (!best || d < best.distanceKm) best = { station: s, distanceKm: Math.round(d * 10) / 10, ageMin: age };
  }
  return best;
}
/** Thai AQI colour band of the station (1 very good … 5 affecting health). */
export const THAI_AQI_BAND = [null, "very_good", "good", "moderate", "unhealthy_sensitive", "unhealthy"] as const;
