import "server-only";
import { getSetting } from "@/lib/settings";
import { envValue } from "@/lib/env";

export type MessagingSettings = { line_enabled: boolean; whatsapp_enabled: boolean; line_quota: number; whatsapp_quota: number };
export const DEFAULT_MESSAGING: MessagingSettings = { line_enabled: true, whatsapp_enabled: true, line_quota: 1000, whatsapp_quota: 500 };
const int = (v: unknown, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : d; };
export const parseMessaging = (v: unknown): MessagingSettings => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { line_enabled: o.line_enabled !== false, whatsapp_enabled: o.whatsapp_enabled !== false, line_quota: int(o.line_quota, DEFAULT_MESSAGING.line_quota), whatsapp_quota: int(o.whatsapp_quota, DEFAULT_MESSAGING.whatsapp_quota) };
};
export const loadMessaging = async () => parseMessaging(await getSetting<unknown>("messaging", DEFAULT_MESSAGING));

// what must be set in Vercel for each channel (a channel without it is not offered to travelers)
export const lineConfigured = () => Boolean(envValue("LINE_CHANNEL_ACCESS_TOKEN") && envValue("LINE_CHANNEL_SECRET") && envValue("LINE_BASIC_ID"));
export const whatsappConfigured = () => Boolean(envValue("WHATSAPP_TOKEN") && envValue("WHATSAPP_PHONE_ID") && envValue("WHATSAPP_TEMPLATE_NOTICE") && envValue("WHATSAPP_TEMPLATE_CODE"));
