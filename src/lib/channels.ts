import "server-only";
import { getSetting } from "@/lib/settings";

export type Channels = { website: string; line: string; email: string; phone: string; hours: string };
export const EMPTY_CHANNELS: Channels = { website: "", line: "", email: "", phone: "", hours: "" };

/** Only plain text and https links get through: this is shown to every visitor. */
export function parseChannels(v: unknown): Channels {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (x: unknown, max = 120) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const web = s(o.website, 200);
  return { website: /^https:\/\/[^\s]+$/.test(web) ? web : "", line: s(o.line), email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(o.email)) ? s(o.email) : "", phone: /^[+\d\s()-]{5,30}$/.test(s(o.phone, 30)) ? s(o.phone, 30) : "", hours: s(o.hours) };
}
export const loadChannels = async () => parseChannels(await getSetting<unknown>("official_channels", EMPTY_CHANNELS));
