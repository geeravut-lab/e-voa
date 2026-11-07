import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { envValue, SITE_URL } from "@/lib/env";
import { hashId } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { loadMessaging, lineConfigured, whatsappConfigured } from "./settings";
import { linePush, lineFlex, lineReply, type SendResult } from "./line";
import { buildFlex } from "./flex";
import { loadBrand } from "@/lib/brand/server";
import { DICTS } from "@/lib/i18n/dict";
import { isLang } from "@/lib/i18n/langs";
import { waTemplate } from "./whatsapp";

export type Channel = "line" | "whatsapp";
const db = () => createAdminClient();
const SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";                        // no 0/O/1/I: a code is read from a screen and typed into a chat
const lineCode = () => Array.from({ length: 8 }, () => SAFE[randomInt(SAFE.length)]).join("");
const waCode = () => String(randomInt(100000, 1000000));
const MAX_ATTEMPTS = 5;

/** What the account page shows. The code hash never leaves the server. */
export async function channelsOf(userId: string) {
  const { data } = await db().from("notification_channels").select("channel, status, address, last_error, code_expires_at, verified_at").eq("owner_id", userId);
  return (data ?? []).map((c) => ({ channel: c.channel as Channel, status: c.status as string, masked: c.address ? (c.channel === "whatsapp" ? `+${c.address.slice(0, 2)}••••${c.address.slice(-3)}` : "LINE ✓") : null, lastError: c.last_error as string | null, waiting: c.status === "pending" && !!c.code_expires_at && Date.parse(c.code_expires_at) > Date.now() }));
}

/** LINE step 1: a one-time code the traveler sends to our official account. Starting again replaces the old code. */
export async function startLineLink(userId: string): Promise<{ ok: true; code: string; basicId: string } | { ok: false; error: string }> {
  if (!lineConfigured() || !(await loadMessaging()).line_enabled) return { ok: false, error: "err_channel_unavailable" };
  const code = lineCode();
  const up = await db().from("notification_channels").upsert({ owner_id: userId, channel: "line", address: null, status: "pending", code_hash: hashId(code), code_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), attempts: 0, last_error: null, verified_at: null }, { onConflict: "owner_id,channel" }).select("id");
  if (up.error || up.data?.length !== 1) return { ok: false, error: "err_generic" };
  return { ok: true, code, basicId: envValue("LINE_BASIC_ID") };
}

/** LINE step 2 (called by the webhook): the traveler wrote the code to the official account → bind their LINE user id. Wrong or expired codes change nothing. */
export async function bindLine(codeRaw: string, lineUserId: string): Promise<{ ok: true; ownerId: string } | { ok: false }> {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code) || !lineUserId) return { ok: false };
  const { data: row } = await db().from("notification_channels").select("id, owner_id, attempts, code_expires_at").eq("channel", "line").eq("status", "pending").eq("code_hash", hashId(code)).maybeSingle();
  if (!row || !row.code_expires_at || Date.parse(row.code_expires_at) < Date.now() || row.attempts >= MAX_ATTEMPTS) return { ok: false };
  const upd = await db().from("notification_channels").update({ address: lineUserId, status: "active", code_hash: null, code_expires_at: null, verified_at: new Date().toISOString(), last_error: null }).eq("id", row.id).eq("status", "pending").select("id");
  if (upd.data?.length !== 1) return { ok: false };
  await audit({ actorId: row.owner_id, action: "channel.link", entity: "channel", entityId: row.id, detail: { channel: "line" } });
  return { ok: true, ownerId: row.owner_id };
}
export async function lineUnfollowed(lineUserId: string) { await db().from("notification_channels").update({ status: "stopped", last_error: "unfollowed" }).eq("channel", "line").eq("address", lineUserId).select("id"); }

/** WhatsApp step 1: the number is typed, a 6-digit code is sent to it as a template message. At most 3 codes an hour per person (checked by the caller). */
export async function startWhatsapp(userId: string, phoneRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!whatsappConfigured() || !(await loadMessaging()).whatsapp_enabled) return { ok: false, error: "err_channel_unavailable" };
  const phone = phoneRaw.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phone)) return { ok: false, error: "err_phone_invalid" };
  const code = waCode();
  const sent = await waTemplate(phone, envValue("WHATSAPP_TEMPLATE_CODE"), [code]);
  if (!sent.ok) { console.error("[messaging] whatsapp code not sent", sent.error); return { ok: false, error: "err_channel_send" }; }
  const up = await db().from("notification_channels").upsert({ owner_id: userId, channel: "whatsapp", address: phone, status: "pending", code_hash: hashId(code), code_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), attempts: 0, last_error: null, verified_at: null }, { onConflict: "owner_id,channel" }).select("id");
  return up.error || up.data?.length !== 1 ? { ok: false, error: "err_generic" } : { ok: true };
}
/** WhatsApp step 2: the code the traveler read from their phone. Five wrong tries lock it until a new code is requested. */
export async function confirmWhatsapp(userId: string, codeRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await db().from("notification_channels").select("id, attempts, code_hash, code_expires_at").eq("owner_id", userId).eq("channel", "whatsapp").eq("status", "pending").maybeSingle();
  if (!row || !row.code_hash || !row.code_expires_at || Date.parse(row.code_expires_at) < Date.now() || row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "err_code_invalid" };
  if (row.code_hash !== hashId(codeRaw.replace(/\D/g, ""))) { await db().from("notification_channels").update({ attempts: row.attempts + 1 }).eq("id", row.id).select("id"); return { ok: false, error: "err_code_invalid" }; }
  const upd = await db().from("notification_channels").update({ status: "active", code_hash: null, code_expires_at: null, verified_at: new Date().toISOString(), last_error: null }).eq("id", row.id).eq("status", "pending").select("id");
  if (upd.data?.length !== 1) return { ok: false, error: "err_generic" };
  await audit({ actorId: userId, action: "channel.link", entity: "channel", entityId: row.id, detail: { channel: "whatsapp" } });
  return { ok: true };
}

export async function disconnectChannel(userId: string, channel: Channel): Promise<boolean> {
  const r = await db().from("notification_channels").delete().eq("owner_id", userId).eq("channel", channel).select("id");
  if (r.data?.length) await audit({ actorId: userId, action: "channel.unlink", entity: "channel", detail: { channel } });
  return (r.data?.length ?? 0) > 0;
}

/** Messages sent through a channel in this calendar month (Thailand time): the quota counts only what was really sent. */
export async function monthCount(channel: Channel): Promise<number> {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const { count } = await db().from("message_log").select("id", { count: "exact", head: true }).eq("channel", channel).eq("status", "sent").gte("at", start);
  return count ?? 0;
}

/** The same notice on every linked and active chat channel, within the monthly quota. Never throws; failures are logged and shown to the user on their account page. */
export async function sendToChannels(n: { userId: string; title: string; body?: string; link?: string; kind?: string; fields?: [string, string][]; note?: string }): Promise<void> {
  const [{ data: chans }, cfg] = await Promise.all([db().from("notification_channels").select("id, channel, address").eq("owner_id", n.userId).eq("status", "active"), loadMessaging()]);
  if (!chans?.length) return;
  const text = [n.title, n.body, n.link ? `${SITE_URL}${n.link}` : ""].filter(Boolean).join("\n");
  // LINE gets a card: colored header by kind, rows, one button (in the person's language); the text above stays for WhatsApp and as the fallback
  const lineChan = chans.find((c) => c.channel === "line");
  let flex: ReturnType<typeof buildFlex> | null = null;
  if (lineChan) {
    const [{ data: prof }, brand] = await Promise.all([db().from("profiles").select("lang").eq("id", n.userId).maybeSingle(), loadBrand()]);
    const t = DICTS[isLang(prof?.lang) ? prof.lang : "en"];
    flex = buildFlex({ brand: brand.name, title: n.title, fields: n.fields, text: n.body, note: n.note, url: n.link?.startsWith("/") ? `${SITE_URL}${n.link}` : undefined, buttonLabel: t.mail_open, kind: n.kind });
  }
  for (const c of chans) {
    const channel = c.channel as Channel;
    if (!c.address || !(channel === "line" ? cfg.line_enabled && lineConfigured() : cfg.whatsapp_enabled && whatsappConfigured())) continue;
    if ((await monthCount(channel)) >= (channel === "line" ? cfg.line_quota : cfg.whatsapp_quota)) continue;          // quota used: the in-app notice and e-mail still go out
    const r: SendResult = channel === "line" ? await pushLine(c.address, text, flex) : await waTemplate(c.address, envValue("WHATSAPP_TEMPLATE_NOTICE"), [n.title, [n.body, n.link ? `${SITE_URL}${n.link}` : ""].filter(Boolean).join(" ")]);
    await db().from("message_log").insert({ owner_id: n.userId, channel, kind: n.kind ?? null, status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error });
    await db().from("notification_channels").update(r.ok ? { last_error: null } : { last_error: r.error, ...(r.permanent ? { status: "stopped" } : {}) }).eq("id", c.id).select("id");
  }
}
/** The card first. If LINE refuses the card (HTTP 400 can also mean "malformed"), the same notice goes as plain text, so a formatting problem never costs a message or stops a channel. */
async function pushLine(to: string, text: string, flex: ReturnType<typeof buildFlex> | null): Promise<SendResult> {
  if (flex) {
    const r = await lineFlex(to, flex); if (r.ok) return r;
    if (!r.error.startsWith("LINE 400")) return r;
    console.error("[messaging] LINE refused the card, sending plain text:", r.error);
  }
  return linePush(to, text);
}
export { lineReply };
