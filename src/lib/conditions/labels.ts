import type { PerLang } from "@/lib/content/types";
import type { AirLevel } from "./rules";
// Words for the conditions page in the three written languages (the others show English).
export const AIR_LABEL: Record<AirLevel, PerLang<string>> = {
  good: { en: "Good", th: "ดี", "zh-CN": "优" }, fair: { en: "Fair", th: "พอใช้", "zh-CN": "良" }, moderate: { en: "Moderate", th: "ปานกลาง", "zh-CN": "中等" },
  sensitive: { en: "Unhealthy for sensitive people", th: "ไม่ดีต่อผู้ไวต่อมลพิษ", "zh-CN": "对敏感人群不健康" }, unhealthy: { en: "Unhealthy", th: "ไม่ดีต่อสุขภาพ", "zh-CN": "不健康" },
};
export const UV_LABEL: Record<"low" | "moderate" | "high" | "very_high" | "extreme", PerLang<string>> = {
  low: { en: "Low", th: "ต่ำ", "zh-CN": "低" }, moderate: { en: "Moderate", th: "ปานกลาง", "zh-CN": "中等" }, high: { en: "High", th: "สูง", "zh-CN": "强" }, very_high: { en: "Very high", th: "สูงมาก", "zh-CN": "很强" }, extreme: { en: "Extreme", th: "รุนแรงมาก", "zh-CN": "极强" },
};
export const WEATHER_LABEL: Record<"clear" | "cloudy" | "fog" | "drizzle" | "rain" | "heavy_rain" | "storm", PerLang<string>> = {
  clear: { en: "Clear or sunny", th: "แจ่มใสหรือแดดจัด", "zh-CN": "晴" }, cloudy: { en: "Cloudy", th: "มีเมฆ", "zh-CN": "多云" }, fog: { en: "Fog", th: "หมอก", "zh-CN": "有雾" }, drizzle: { en: "Drizzle", th: "ฝนปรอย", "zh-CN": "毛毛雨" },
  rain: { en: "Rain", th: "ฝนตก", "zh-CN": "下雨" }, heavy_rain: { en: "Heavy rain", th: "ฝนตกหนัก", "zh-CN": "大雨" }, storm: { en: "Thunderstorm", th: "พายุฝนฟ้าคะนอง", "zh-CN": "雷暴" },
};
