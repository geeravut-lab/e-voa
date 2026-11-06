import "server-only";
import { envValue } from "@/lib/env";
import type { SendResult } from "./line";

/** WhatsApp only lets a business start a conversation with an approved TEMPLATE, so every message here is a template with text parameters. */
export async function waTemplate(to: string, template: string, params: string[]): Promise<SendResult> {
  const url = `${(envValue("WHATSAPP_API_URL") || "https://graph.facebook.com").replace(/\/$/, "")}/${envValue("WHATSAPP_API_VERSION") || "v21.0"}/${envValue("WHATSAPP_PHONE_ID")}/messages`;
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${envValue("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: envValue("WHATSAPP_TEMPLATE_LANG") || "en" }, components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p.slice(0, 1000) })) }] } }) });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
    return { ok: false, error: `WhatsApp ${res.status}/${j.error?.code ?? ""}: ${(j.error?.message ?? "").slice(0, 120)}`, permanent: res.status === 400 && (j.error?.code === 131026 || j.error?.code === 131030) };
  } catch (e) { return { ok: false, error: `WhatsApp unreachable: ${(e as Error).message}`.slice(0, 160), permanent: false }; }
}
