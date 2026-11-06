// "Do I need a visa?" The lists of nationalities come from the admin (platform_settings.eligibility); they are policy data that must come from
// Immigration, so nothing is assumed here. Pure and tested.

export type EligibilityConfig = { voa: string[]; visa_free: string[] };
export type EligibilityResult = "voa" | "visa_free" | "other" | "unknown";

export const parseEligibility = (v: unknown): EligibilityConfig => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((c): c is string => typeof c === "string" && /^[A-Z]{3}$/.test(c)) : []);
  return { voa: list(o.voa), visa_free: list(o.visa_free) };
};

/** `code` is the 3-letter nationality code (the master list's CountryCode). */
export function checkEligibility(code: string | null | undefined, cfg: EligibilityConfig): EligibilityResult {
  if (!code) return "unknown";
  const c = code.toUpperCase();
  if (cfg.voa.length === 0 && cfg.visa_free.length === 0) return "unknown";   // the admin has not entered the official lists yet: do not guess
  if (cfg.visa_free.includes(c)) return "visa_free";
  if (cfg.voa.includes(c)) return "voa";
  return "other";
}
