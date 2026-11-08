import type { FamText } from "@/lib/family/text-type";
/**
 * The toolkit texts of ONE extra language, keyed by the id of what they translate (so nothing English is repeated here).
 * Part A (toolkit + rental + weather advice) lives in lang/<code>-a.ts, part B (incident guides + family check-in) in lang/<code>-b.ts.
 * The built-in lists (toolkit.ts, incidents.ts, rental.ts, conditions/rules.ts, family/text.ts) pick these up at load time.
 */
export type PackA = {
  emergency: Record<string, [label: string, use: string]>;        // by number
  emergencyNote: string;
  phrases: Record<string, string>;                                   // by phrase id: what it means in this language
  rules: Record<string, [title: string, text: string]>;             // by rule id
  levels: { illegal: string; restricted: string; respect: string; careful: string };
  rulesNote: string;
  tdac: { intro: string; steps: string[]; warn: string[]; note: string };
  stay: { intro: string; how: string; extend: string; overstay: string; stamp: string };
  rental: { groups: Record<string, string>; items: Record<string, string>; slots: Record<string, string> };
  advice: Record<"air_fair" | "air_moderate" | "air_sensitive" | "air_unhealthy" | "heat_caution" | "heat_danger" | "uv_high" | "uv_very_high" | "uv_extreme" | "rain" | "storm" | "wind", string>;
  adviceNote: string;
  air: Record<"good" | "fair" | "moderate" | "sensitive" | "unhealthy", string>;
  uv: Record<"low" | "moderate" | "high" | "very_high" | "extreme", string>;
  weather: Record<"clear" | "cloudy" | "fog" | "drizzle" | "rain" | "heavy_rain" | "storm", string>;
};
export type PackB = {
  incidents: Record<string, { title: string; summary: string; steps: string[] }>;
  incidentNote: string;
  family: FamText;
};
