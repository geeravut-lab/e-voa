import "server-only";
import { ADVICE, WEATHER_EN, advise, airLevel, uvBand, weatherGroup } from "./rules";
import { PLACES, findPlace } from "./places";
import { SOURCE, fetchConditions } from "./service";
import { warningLevel } from "./tmd";

const AIR_EN = { good: "good", fair: "fair", moderate: "moderate (above the WHO guideline, below the Thai 24-hour limit)", sensitive: "unhealthy for sensitive people (above the Thai 24-hour limit of 37.5 µg/m3)", unhealthy: "unhealthy for everyone" } as const;
/** The assistant's tool: live weather, PM2.5 and heat/UV/rain advice for a place in Thailand, as short JSON the model explains in plain words. Never throws; says plainly when it has no data. */
export async function conditionsTool(input: unknown): Promise<string> {
  const q = String((input as { place?: unknown })?.place ?? "");
  const place = findPlace(q);
  if (!place) return `Unknown place "${q.slice(0, 60)}". Places with live data: ${PLACES.map((p) => p.name.en).join("; ")}. Ask the user which of these is closest, or say you have no live data for that place.`;
  const c = await fetchConditions(place);
  if (!c.ok) return `Live conditions for ${place.name.en} are not available right now. Say so, do not guess numbers, and point to the Thai Meteorological Department and the Air4Thai website for official data.`;
  const r = c.readings, wg = weatherGroup(r.weatherCode), air = airLevel(r.pm25), uv = uvBand(r.uvNow ?? r.uvMax);
  return JSON.stringify({
    place: place.name.en, local_time_of_reading: r.time, source: SOURCE, data_note: "Weather and UV are modelled values for the area (about hourly), not a measurement at the user's street. PM2.5 is measured when a station is named, otherwise modelled. Only official_warnings are official warnings.",
    weather: wg ? WEATHER_EN[wg] : null, temperature_c: r.tempC, feels_like_c: r.feelsC, humidity_percent: r.humidity, wind_kmh: r.windKmh, gusts_kmh: r.gustKmh, rain_now_mm: r.precipMm,
    today: { max_temperature_c: r.tempMaxC, rain_probability_max_percent: r.rainProbMax, uv_index_max: r.uvMax },
    air: { pm2_5_ug_m3: r.pm25, pm10_ug_m3: r.pm10, ...(c.air.source === "air4thai" ? { source: "Air4Thai measuring station (Pollution Control Department)", station: c.air.station.name, station_area: c.air.station.area, station_distance_km: c.air.station.distanceKm, measured_at_thai_time: c.air.station.at, thai_aqi: c.air.station.thaiAqi } : { source: "modelled estimate for the area (no recent station nearby)", us_aqi: r.usAqi }), pm2_5_level: air ? AIR_EN[air] : null }, uv_now: r.uvNow, uv_band: uv,
    official_warnings: c.warningsKnown ? (c.warnings.length === 0 ? "No active Thai Meteorological Department warning names this province right now." : c.warnings.map((w) => ({ source: "Thai Meteorological Department (CAP alert, text is in Thai: translate it for the user)", event: w.event, severity: w.severity, level: warningLevel(w.severity), valid_until: w.expires, headline_th: w.headline, description_th: w.description.slice(0, 600), instruction_th: w.instruction.slice(0, 400) }))) : "The official warnings feed could not be read just now: say so and point to the Thai Meteorological Department (tmd.go.th).",
    advice: advise(r).map((a) => ({ level: a.level, text: ADVICE[a.key].en })),
    emergency: "Police 191, Tourist Police 1155 (English), ambulance 1669.",
  });
}
