// Turns weather and air readings into plain advice. PURE: the page, the assistant tool and the tests share it.
// The thresholds are the usual public ones (WHO UV index bands, apparent-temperature bands like the US heat index, the Thai 24-hour PM2.5 limit of 37.5 µg/m³).
// The readings are modelled current values, not a 24-hour average and not a measurement at the traveler's street: the texts say "about".
import type { PerLang } from "@/lib/content/types";

export type Readings = {
  time: string | null;                               // local time of the reading (Asia/Bangkok), ISO without zone
  tempC: number | null; feelsC: number | null; humidity: number | null; windKmh: number | null; gustKmh: number | null; precipMm: number | null; weatherCode: number | null;
  rainProbMax: number | null; tempMaxC: number | null; uvMax: number | null;
  pm25: number | null; pm10: number | null; usAqi: number | null; uvNow: number | null;
};
export type AdviceKey = "air_fair" | "air_moderate" | "air_sensitive" | "air_unhealthy" | "heat_caution" | "heat_danger" | "uv_high" | "uv_very_high" | "uv_extreme" | "rain" | "storm" | "wind";
export type Advice = { key: AdviceKey; level: "info" | "caution" | "warning" };

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const emptyReadings = (): Readings => ({ time: null, tempC: null, feelsC: null, humidity: null, windKmh: null, gustKmh: null, precipMm: null, weatherCode: null, rainProbMax: null, tempMaxC: null, uvMax: null, pm25: null, pm10: null, usAqi: null, uvNow: null });

/** Reads the two answers of the weather service (forecast + air quality). Anything missing or odd becomes null: never a crash, never an invented number. */
export function parseReadings(forecast: unknown, air: unknown): Readings {
  const f = (forecast && typeof forecast === "object" ? forecast : {}) as { current?: Record<string, unknown>; daily?: Record<string, unknown[]> };
  const a = (air && typeof air === "object" ? air : {}) as { current?: Record<string, unknown> };
  const c = f.current ?? {}, d = f.daily ?? {}, ac = a.current ?? {};
  const rng = (v: number | null, lo: number, hi: number) => (v !== null && v >= lo && v <= hi ? v : null);
  return {
    time: typeof c.time === "string" ? c.time.slice(0, 16) : typeof ac.time === "string" ? ac.time.slice(0, 16) : null,
    tempC: rng(n(c.temperature_2m), -60, 70), feelsC: rng(n(c.apparent_temperature), -80, 90), humidity: rng(n(c.relative_humidity_2m), 0, 100),
    windKmh: rng(n(c.wind_speed_10m), 0, 400), gustKmh: rng(n(c.wind_gusts_10m), 0, 500), precipMm: rng(n(c.precipitation), 0, 500), weatherCode: rng(n(c.weather_code), 0, 99),
    rainProbMax: rng(n(d.precipitation_probability_max?.[0]), 0, 100), tempMaxC: rng(n(d.temperature_2m_max?.[0]), -60, 70), uvMax: rng(n(d.uv_index_max?.[0]), 0, 25),
    pm25: rng(n(ac.pm2_5), 0, 2000), pm10: rng(n(ac.pm10), 0, 3000), usAqi: rng(n(ac.us_aqi), 0, 1000), uvNow: rng(n(ac.uv_index), 0, 25),
  };
}

export type AirLevel = "good" | "fair" | "moderate" | "sensitive" | "unhealthy";
/** PM2.5 in µg/m³ → a band. 37.5 is the Thai 24-hour standard; 15 is the WHO guideline. */
export const airLevel = (pm25: number | null): AirLevel | null => (pm25 === null ? null : pm25 <= 15 ? "good" : pm25 <= 25 ? "fair" : pm25 <= 37.5 ? "moderate" : pm25 <= 75 ? "sensitive" : "unhealthy");
export const uvBand = (uv: number | null): "low" | "moderate" | "high" | "very_high" | "extreme" | null => (uv === null ? null : uv < 3 ? "low" : uv < 6 ? "moderate" : uv < 8 ? "high" : uv < 11 ? "very_high" : "extreme");
/** WMO weather codes grouped into a few words (English; the page translates the group). */
export const weatherGroup = (code: number | null): "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "heavy_rain" | "storm" | null => {
  if (code === null) return null;
  if (code === 0 || code === 1) return "clear"; if (code === 2 || code === 3) return "cloudy"; if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle"; if ((code >= 61 && code <= 65) || (code >= 80 && code <= 81)) return code === 65 ? "heavy_rain" : "rain";
  if (code === 82) return "heavy_rain"; if (code >= 95) return "storm"; return "cloudy";
};
export const WEATHER_EN: Record<NonNullable<ReturnType<typeof weatherGroup>>, string> = { clear: "clear or mostly sunny", cloudy: "cloudy", fog: "foggy", drizzle: "drizzle", rain: "rain", heavy_rain: "heavy rain", storm: "thunderstorm" };

/** What is worth telling a traveler right now. An empty list means nothing unusual in the data we have. */
export function advise(r: Readings): Advice[] {
  const out: Advice[] = [];
  const air = airLevel(r.pm25);
  if (air === "fair") out.push({ key: "air_fair", level: "info" }); else if (air === "moderate") out.push({ key: "air_moderate", level: "caution" }); else if (air === "sensitive") out.push({ key: "air_sensitive", level: "warning" }); else if (air === "unhealthy") out.push({ key: "air_unhealthy", level: "warning" });
  const feels = r.feelsC ?? r.tempC; if (feels !== null) { if (feels >= 41) out.push({ key: "heat_danger", level: "warning" }); else if (feels >= 35) out.push({ key: "heat_caution", level: "caution" }); }
  const uv = r.uvNow ?? r.uvMax, band = uvBand(uv); if (band === "high") out.push({ key: "uv_high", level: "caution" }); else if (band === "very_high") out.push({ key: "uv_very_high", level: "warning" }); else if (band === "extreme") out.push({ key: "uv_extreme", level: "warning" });
  const wg = weatherGroup(r.weatherCode);
  if (wg === "storm") out.push({ key: "storm", level: "warning" });
  else if (wg === "heavy_rain" || (r.rainProbMax ?? 0) >= 70 || (r.precipMm ?? 0) >= 7.6) out.push({ key: "rain", level: "caution" });
  if ((r.gustKmh ?? r.windKmh ?? 0) >= 50) out.push({ key: "wind", level: "caution" });
  return out;
}

export const ADVICE: Record<AdviceKey, PerLang<string>> = {
  air_fair: { en: "Air is fair. Very sensitive people may notice it.", th: "คุณภาพอากาศพอใช้ ผู้ที่ไวต่อมลพิษอาจรู้สึกได้", "zh-CN": "空气质量尚可，极敏感人群可能会有感觉。" },
  air_moderate: { en: "PM2.5 is moderate. People with asthma, heart or lung conditions, children and older people should take it easier outdoors.", th: "ค่า PM2.5 ระดับปานกลาง ผู้มีโรคหอบหืด โรคหัวใจ โรคปอด เด็ก และผู้สูงอายุควรลดกิจกรรมกลางแจ้ง", "zh-CN": "PM2.5 为中等水平。哮喘、心肺疾病患者、儿童和老人应减少户外活动。" },
  air_sensitive: { en: "PM2.5 is high (above the Thai 24-hour limit of 37.5 µg/m³). Sensitive people should avoid long outdoor activity and wear a well-fitting mask (N95 or similar).", th: "ค่า PM2.5 สูง (เกินมาตรฐานเฉลี่ย 24 ชั่วโมงของไทยที่ 37.5 มคก./ลบ.ม.) ผู้ไวต่อมลพิษควรเลี่ยงกิจกรรมกลางแจ้งนาน ๆ และสวมหน้ากากที่แนบหน้า (N95 หรือเทียบเท่า)", "zh-CN": "PM2.5 偏高（超过泰国 24 小时标准 37.5 微克/立方米）。敏感人群应避免长时间户外活动，并佩戴贴合的口罩（N95 或同等）。" },
  air_unhealthy: { en: "PM2.5 is very high. Everyone should cut outdoor exercise, stay in air-conditioned or filtered rooms when possible, and wear an N95 mask outside. Seek medical help for breathing difficulty.", th: "ค่า PM2.5 สูงมาก ทุกคนควรลดการออกกำลังกายกลางแจ้ง อยู่ในห้องปรับอากาศหรือมีเครื่องกรองถ้าทำได้ และสวมหน้ากาก N95 เมื่อออกนอกอาคาร หากหายใจลำบากให้รีบพบแพทย์", "zh-CN": "PM2.5 非常高。所有人都应减少户外运动，尽量待在有空调或净化的室内，外出佩戴 N95 口罩。如呼吸困难请就医。" },
  heat_caution: { en: "It feels very hot. Drink water often, rest in the shade, and avoid hard exercise at midday.", th: "อากาศร้อนจัด ดื่มน้ำบ่อย ๆ พักในที่ร่ม และเลี่ยงการออกกำลังกายหนักช่วงเที่ยง", "zh-CN": "体感很热。请经常喝水、在阴凉处休息，避免正午剧烈运动。" },
  heat_danger: { en: "Dangerous heat. Heat exhaustion and heatstroke are possible: stay indoors or in shade in the afternoon, drink water, and get medical help (call 1669) for confusion, fainting or stopped sweating.", th: "ร้อนจนอันตราย เสี่ยงเพลียแดดและลมแดด ช่วงบ่ายควรอยู่ในอาคารหรือที่ร่ม ดื่มน้ำ และขอความช่วยเหลือทางการแพทย์ (โทร 1669) หากสับสน เป็นลม หรือเหงื่อหยุดออก", "zh-CN": "高温有危险，可能中暑。下午请待在室内或阴凉处，多喝水；如出现意识模糊、昏厥或停止出汗，请就医（拨打 1669）。" },
  uv_high: { en: "UV is high: sunscreen, hat and sunglasses, and shade around midday.", th: "รังสี UV สูง ทาครีมกันแดด สวมหมวกและแว่นกันแดด และหาที่ร่มช่วงเที่ยง", "zh-CN": "紫外线较强：请涂防晒霜、戴帽子和墨镜，正午尽量待在阴凉处。" },
  uv_very_high: { en: "UV is very high: burn in minutes. Sunscreen SPF 50, cover up, and avoid the midday sun.", th: "รังสี UV สูงมาก ผิวไหม้ได้ในไม่กี่นาที ทาครีมกันแดด SPF 50 ปกปิดร่างกาย และเลี่ยงแดดเที่ยง", "zh-CN": "紫外线很强，几分钟就可能晒伤。请涂 SPF 50 防晒、遮盖身体，避开正午阳光。" },
  uv_extreme: { en: "UV is extreme. Stay out of the sun around midday, and cover up fully with SPF 50.", th: "รังสี UV รุนแรงมาก เลี่ยงแดดช่วงเที่ยง ปกปิดร่างกายให้มิดชิดและทาครีมกันแดด SPF 50", "zh-CN": "紫外线极强。正午避免日晒，全身遮盖并涂 SPF 50 防晒。" },
  rain: { en: "Rain is likely or heavy. Streets can flood quickly and scooters get slippery: allow extra time and avoid river and mountain trips.", th: "มีโอกาสฝนตกหรือฝนหนัก ถนนอาจน้ำท่วมเร็วและลื่นสำหรับมอเตอร์ไซค์ เผื่อเวลาเดินทางและเลี่ยงทริปแม่น้ำและภูเขา", "zh-CN": "可能有雨或大雨。道路易积水、摩托车打滑，请预留更多时间，避免河流和山区行程。" },
  storm: { en: "Thunderstorm. Stay away from open water, beaches, boats and tall trees, and wait indoors until it passes.", th: "พายุฝนฟ้าคะนอง อยู่ห่างจากทะเล ชายหาด เรือ และต้นไม้สูง รอในอาคารจนกว่าจะผ่านไป", "zh-CN": "雷暴天气。请远离水域、海滩、船只和高大树木，在室内等待风暴过去。" },
  wind: { en: "Strong wind. Boat trips and island ferries may be cancelled or rough: check with the operator before you go.", th: "ลมแรง เรือท่องเที่ยวและเรือข้ามเกาะอาจถูกยกเลิกหรือคลื่นแรง สอบถามผู้ให้บริการก่อนเดินทาง", "zh-CN": "风力较强。游船和跨岛渡轮可能取消或颠簸，出发前请向运营方确认。" },
};
export const ADVICE_NOTE: PerLang<string> = {
  en: "Modelled values for the area, not a measurement at your street, and not official warnings. For official warnings see the Thai Meteorological Department; in an emergency call 1669, 191 or 1155.",
  th: "เป็นค่าประมาณจากแบบจำลองของพื้นที่ ไม่ใช่การวัดที่หน้าบ้านคุณ และไม่ใช่คำเตือนอย่างเป็นทางการ ดูคำเตือนทางการได้ที่กรมอุตุนิยมวิทยา กรณีฉุกเฉินโทร 1669, 191 หรือ 1155",
  "zh-CN": "这是该区域的模型估算值，并非您所在街道的实测，也不是官方预警。官方预警请查看泰国气象局；紧急情况请拨打 1669、191 或 1155。",
};
