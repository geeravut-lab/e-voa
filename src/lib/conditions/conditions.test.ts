import { describe, expect, it } from "vitest";
import { PLACES, distanceKm, findPlace, nearestPlace } from "@/lib/conditions/places";
import { ADVICE, ADVICE_NOTE, advise, airLevel, emptyReadings, parseReadings, uvBand, weatherGroup, type AdviceKey, type Readings } from "@/lib/conditions/rules";

describe("places", () => {
  it("are unique, inside Thailand, and named in three languages", () => {
    expect(new Set(PLACES.map((p) => p.slug)).size).toBe(PLACES.length);
    for (const p of PLACES) { expect(p.lat).toBeGreaterThan(5); expect(p.lat).toBeLessThan(21); expect(p.lon).toBeGreaterThan(97); expect(p.lon).toBeLessThan(106); for (const l of ["en", "th", "zh-CN"] as const) expect(p.name[l]).toBeTruthy(); }
  });
  it("are found by slug, name, alias, Thai name or a word inside a sentence", () => {
    expect(findPlace("phuket")?.slug).toBe("phuket"); expect(findPlace("Chiang Mai")?.slug).toBe("chiang-mai"); expect(findPlace("ภูเก็ต")?.slug).toBe("phuket"); expect(findPlace("曼谷")?.slug).toBe("bangkok");
    expect(findPlace("Is it safe in Patong tonight?")?.slug).toBe("phuket"); expect(findPlace("koh samui")?.slug).toBe("koh-samui"); expect(findPlace("  KRABI  ")?.slug).toBe("krabi"); expect(findPlace("Ao Nang beach")?.slug).toBe("krabi");
  });
  it("say nothing for what is not a place on the list", () => { for (const q of ["", "x", "Tokyo", "weather", null, undefined, 42]) expect(findPlace(q as unknown), String(q)).toBeNull(); });
  it("find the nearest place to a position, and none when far from all", () => {
    expect(nearestPlace(7.9, 98.3)?.slug).toBe("phuket"); expect(nearestPlace(13.75, 100.52)?.slug).toBe("bangkok"); expect(nearestPlace(35.68, 139.7)).toBeNull(); expect(nearestPlace(Number.NaN, 100)).toBeNull(); expect(nearestPlace(95, 100)).toBeNull();
    expect(distanceKm({ lat: 13.7563, lon: 100.5018 }, { lat: 18.7883, lon: 98.9853 })).toBeGreaterThan(550); expect(distanceKm({ lat: 13.7563, lon: 100.5018 }, { lat: 18.7883, lon: 98.9853 })).toBeLessThan(600);
  });
});

describe("reading the weather service's answers", () => {
  const forecast = { current: { time: "2026-11-07T14:00", temperature_2m: 31.4, relative_humidity_2m: 66, apparent_temperature: 38.2, precipitation: 0.2, weather_code: 2, wind_speed_10m: 12, wind_gusts_10m: 25 }, daily: { precipitation_probability_max: [40], temperature_2m_max: [33.1], uv_index_max: [9.2] } };
  const air = { current: { time: "2026-11-07T14:00", pm2_5: 41.5, pm10: 60, us_aqi: 118, uv_index: 7.5 } };
  it("map every field", () => {
    expect(parseReadings(forecast, air)).toEqual({ time: "2026-11-07T14:00", tempC: 31.4, feelsC: 38.2, humidity: 66, windKmh: 12, gustKmh: 25, precipMm: 0.2, weatherCode: 2, rainProbMax: 40, tempMaxC: 33.1, uvMax: 9.2, pm25: 41.5, pm10: 60, usAqi: 118, uvNow: 7.5 });
  });
  it("turn anything missing, wrong or absurd into null — never a crash and never an invented number", () => {
    expect(parseReadings(null, null)).toEqual(emptyReadings()); expect(parseReadings("x", 5)).toEqual(emptyReadings());
    const r = parseReadings({ current: { temperature_2m: "hot", apparent_temperature: 999, relative_humidity_2m: 250, weather_code: 9999 }, daily: { precipitation_probability_max: "x" } }, { current: { pm2_5: -4, us_aqi: null } });
    expect(r).toEqual(emptyReadings()); expect(parseReadings(forecast, null).pm25).toBeNull(); expect(parseReadings(null, air).tempC).toBeNull();
  });
});

describe("bands", () => {
  it("PM2.5: 15 WHO guideline, 37.5 Thai 24-hour limit, 75 for everyone", () => {
    expect([null, 5, 15, 15.1, 25, 25.1, 37.5, 37.6, 75, 75.1].map((v) => airLevel(v))).toEqual([null, "good", "good", "fair", "fair", "moderate", "moderate", "sensitive", "sensitive", "unhealthy"]);
  });
  it("UV: WHO bands", () => { expect([null, 0, 2.9, 3, 5.9, 6, 7.9, 8, 10.9, 11, 14].map((v) => uvBand(v))).toEqual([null, "low", "low", "moderate", "moderate", "high", "high", "very_high", "very_high", "extreme", "extreme"]); });
  it("weather codes group into a few words", () => { expect([null, 0, 3, 45, 53, 61, 65, 81, 82, 95, 99, 71].map((c) => weatherGroup(c))).toEqual([null, "clear", "cloudy", "fog", "drizzle", "rain", "heavy_rain", "rain", "heavy_rain", "storm", "storm", "cloudy"]); });
});

describe("advice", () => {
  const base: Readings = { ...emptyReadings(), tempC: 30, feelsC: 31, pm25: 10, uvNow: 2, weatherCode: 1, rainProbMax: 10, precipMm: 0 };
  const keys = (o: Partial<Readings>) => advise({ ...base, ...o }).map((a) => a.key);
  it("is empty when nothing is unusual or nothing is known", () => { expect(keys({})).toEqual([]); expect(advise(emptyReadings())).toEqual([]); });
  it("warns about air, heat, UV, rain, storm and wind at the right levels", () => {
    expect(keys({ pm25: 20 })).toEqual(["air_fair"]); expect(keys({ pm25: 30 })).toEqual(["air_moderate"]); expect(keys({ pm25: 60 })).toEqual(["air_sensitive"]); expect(keys({ pm25: 120 })).toEqual(["air_unhealthy"]);
    expect(keys({ feelsC: 36 })).toEqual(["heat_caution"]); expect(keys({ feelsC: 42 })).toEqual(["heat_danger"]); expect(keys({ feelsC: null, tempC: 41 })).toEqual(["heat_danger"]);
    expect(keys({ uvNow: 7 })).toEqual(["uv_high"]); expect(keys({ uvNow: 9 })).toEqual(["uv_very_high"]); expect(keys({ uvNow: 12 })).toEqual(["uv_extreme"]); expect(keys({ uvNow: null, uvMax: 9 })).toEqual(["uv_very_high"]);
    expect(keys({ rainProbMax: 80 })).toEqual(["rain"]); expect(keys({ weatherCode: 65 })).toEqual(["rain"]); expect(keys({ precipMm: 9 })).toEqual(["rain"]); expect(keys({ weatherCode: 96 })).toEqual(["storm"]); expect(keys({ gustKmh: 60 })).toEqual(["wind"]);
    expect(advise({ ...base, pm25: 120 })[0].level).toBe("warning"); expect(advise({ ...base, feelsC: 36 })[0].level).toBe("caution");
  });
  it("has text in English, Thai and Chinese for every piece of advice, and the heat warning names the ambulance number", () => {
    const all: AdviceKey[] = ["air_fair", "air_moderate", "air_sensitive", "air_unhealthy", "heat_caution", "heat_danger", "uv_high", "uv_very_high", "uv_extreme", "rain", "storm", "wind"];
    for (const k of all) for (const l of ["en", "th", "zh-CN"] as const) expect(ADVICE[k][l].length, `${k} ${l}`).toBeGreaterThan(12);
    expect(ADVICE.heat_danger.en).toContain("1669"); expect(ADVICE_NOTE.en).toMatch(/not an official warning|not official warnings/); for (const l of ["en", "th", "zh-CN"] as const) expect(ADVICE_NOTE[l]).toContain("1669");
  });
});
