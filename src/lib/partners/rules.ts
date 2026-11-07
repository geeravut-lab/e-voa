// Which add-ons may be offered for a trip. The airports and the Express restriction come from platform_settings.addon_rules
// (legacy rule: physical SIM and VIP only at Suvarnabhumi and not with Express). eSIM, insurance and health have no airport rule. Pure.
export type AddonCategory = "insurance" | "sim" | "esim" | "vip" | "health";
export const ADDON_CATEGORIES: AddonCategory[] = ["insurance", "esim", "sim", "vip", "health"];

export type AddonRules = { sim_airports: number[]; sim_blocked_for_express: boolean; vip_airports: number[]; vip_blocked_for_express: boolean };
export const DEFAULT_ADDON_RULES: AddonRules = { sim_airports: [1], sim_blocked_for_express: true, vip_airports: [1], vip_blocked_for_express: true };
export const parseAddonRules = (v: unknown): AddonRules => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const ids = (x: unknown, d: number[]) => (Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n)) : d);
  const b = (x: unknown, d: boolean) => (typeof x === "boolean" ? x : d);
  return { sim_airports: ids(o.sim_airports, [1]), sim_blocked_for_express: b(o.sim_blocked_for_express, true), vip_airports: ids(o.vip_airports, [1]), vip_blocked_for_express: b(o.vip_blocked_for_express, true) };
};

export type Offer = { available: true } | { available: false; reason: "airport" | "express" | "stock" };

export function addonOffer(category: AddonCategory, trip: { arrivalAirportId: number | null; package: "regular" | "express" }, r: AddonRules): Offer {
  if (category === "sim" || category === "vip") {
    const airports = category === "sim" ? r.sim_airports : r.vip_airports;
    const blockExpress = category === "sim" ? r.sim_blocked_for_express : r.vip_blocked_for_express;
    if (trip.arrivalAirportId === null || !airports.includes(trip.arrivalAirportId)) return { available: false, reason: "airport" };
    if (blockExpress && trip.package === "express") return { available: false, reason: "express" };
  }
  return { available: true };
}

/** The partner each category is bought from. */
export const providerOf = (c: AddonCategory): "insurance" | "sim" | "vip" | "bhs" => (c === "insurance" ? "insurance" : c === "sim" || c === "esim" ? "sim" : c === "vip" ? "vip" : "bhs");
