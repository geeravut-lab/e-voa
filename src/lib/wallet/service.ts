import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { saveUrl, walletConfig, objectIdFor } from "./google";
import { patchObject } from "./google-api";
import { appleConfig, applePush, buildApplePass } from "./apple";
import { fingerprintOf, loadPassContent, type PassContent } from "./content";

type Platform = "google" | "apple";
const db = () => createAdminClient();

/** Remembers that a pass was handed out (or refreshed), so a later change can be sent to it. The Apple auth token is made once and kept. */
async function recordPass(platform: Platform, p: PassContent, serial: string): Promise<{ id: string; authToken: string | null } | null> {
  const { data: old } = await db().from("wallet_passes").select("id, auth_token").eq("application_id", p.applicationId).eq("platform", platform).maybeSingle();
  const authToken = platform === "apple" ? old?.auth_token ?? randomBytes(24).toString("base64url") : null;
  const row = { application_id: p.applicationId, platform, serial, auth_token: authToken, lang: p.lang, fingerprint: fingerprintOf(p), synced_at: new Date().toISOString(), last_error: null };
  const { data, error } = await db().from("wallet_passes").upsert(row, { onConflict: "application_id,platform" }).select("id");
  if (error || data?.length !== 1) { console.error("[wallet] record failed", error?.message); return null; }
  return { id: data[0].id, authToken };
}

/** The Google "Save to Wallet" link: only for the owner of an APPROVED (or used) application, and only when Google Wallet is set up. */
export async function googleWalletLink(userId: string, applicationId: string, ctx: { lang: string }): Promise<{ ok: true; url: string } | { ok: false; error: "not_configured" | "not_found" }> {
  const cfg = walletConfig(SITE_URL); if (!cfg) return { ok: false, error: "not_configured" };
  const p = await loadPassContent(applicationId, { ownerId: userId, lang: ctx.lang }); if (!p) return { ok: false, error: "not_found" };
  await recordPass("google", p, objectIdFor(cfg, p.ref));
  return { ok: true, url: saveUrl(cfg, p, p.active) };
}

/** The Apple .pkpass for the owner of an approved application. */
export async function appleWalletFile(userId: string, applicationId: string, ctx: { lang: string }): Promise<{ ok: true; file: Buffer; filename: string } | { ok: false; error: "not_configured" | "not_found" | "failed" }> {
  const cfg = appleConfig(SITE_URL); if (!cfg) return { ok: false, error: "not_configured" };
  const p = await loadPassContent(applicationId, { ownerId: userId, lang: ctx.lang }); if (!p) return { ok: false, error: "not_found" };
  const serial = `evoa-${p.ref}`, rec = await recordPass("apple", p, serial); if (!rec?.authToken) return { ok: false, error: "failed" };
  try { return { ok: true, file: await buildApplePass(cfg, p, serial, rec.authToken, p.arrivalIso), filename: `evoa-${p.ref}.pkpass` }; }
  catch (e) { console.error("[wallet] apple pass failed", (e as Error).message); return { ok: false, error: "failed" }; }
}

// ---- Apple's web service for passes already on a phone (register for updates, list what changed, fetch the new file) ----
type PassRow = { id: string; application_id: string; serial: string; auth_token: string | null; lang: string; updated_at: string };
const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const passBySerial = async (serial: string): Promise<PassRow | null> => (await db().from("wallet_passes").select("id, application_id, serial, auth_token, lang, updated_at").eq("platform", "apple").eq("serial", serial).maybeSingle()).data as PassRow | null;
/** `Authorization: ApplePass <token>` must carry this pass's own token. */
const authorised = (row: PassRow | null, header: string | null): row is PassRow => !!row?.auth_token && !!header?.startsWith("ApplePass ") && sameToken(header.slice(10), row.auth_token);
const rightType = (passTypeId: string) => passTypeId === appleConfig(SITE_URL)?.passTypeId;

export async function appleRegister(deviceId: string, passTypeId: string, serial: string, auth: string | null, pushToken: unknown): Promise<201 | 200 | 401 | 400 | 404> {
  if (!rightType(passTypeId)) return 404;
  const row = await passBySerial(serial); if (!authorised(row, auth)) return 401;
  if (typeof pushToken !== "string" || !/^[0-9A-Fa-f]{16,200}$/.test(pushToken) || !/^[\w.-]{1,100}$/.test(deviceId)) return 400;
  const { data: had } = await db().from("wallet_registrations").select("device_id").eq("device_id", deviceId).eq("pass_id", row.id).maybeSingle();
  const { error } = await db().from("wallet_registrations").upsert({ device_id: deviceId, pass_id: row.id, push_token: pushToken }, { onConflict: "device_id,pass_id" });
  return error ? 400 : had ? 200 : 201;
}
export async function appleUnregister(deviceId: string, passTypeId: string, serial: string, auth: string | null): Promise<200 | 401 | 404> {
  if (!rightType(passTypeId)) return 404;
  const row = await passBySerial(serial); if (!authorised(row, auth)) return 401;
  await db().from("wallet_registrations").delete().eq("device_id", deviceId).eq("pass_id", row.id);
  return 200;
}
/** Passes of this device that changed after the tag the phone last got (the tag is a millisecond clock value). null = nothing new. */
export async function appleChangedSerials(deviceId: string, passTypeId: string, since: string | null): Promise<{ serialNumbers: string[]; lastUpdated: string } | null> {
  if (!rightType(passTypeId)) return null;
  const { data: regs } = await db().from("wallet_registrations").select("pass_id").eq("device_id", deviceId);
  const ids = (regs ?? []).map((r) => r.pass_id); if (!ids.length) return null;
  const { data: rows } = await db().from("wallet_passes").select("serial, updated_at").in("id", ids);
  const after = since && /^\d{1,16}$/.test(since) ? Number(since) : 0;
  const changed = (rows ?? []).filter((r) => Date.parse(r.updated_at) > after);
  return changed.length ? { serialNumbers: changed.map((r) => r.serial), lastUpdated: String(Math.max(...changed.map((r) => Date.parse(r.updated_at)))) } : null;
}
export async function applePassForPhone(passTypeId: string, serial: string, auth: string | null, ifModifiedSince: string | null): Promise<{ status: 200; file: Buffer; lastModified: string } | { status: 304 | 401 | 404 | 500 }> {
  const cfg = appleConfig(SITE_URL); if (!cfg || passTypeId !== cfg.passTypeId) return { status: 404 };
  const row = await passBySerial(serial); if (!authorised(row, auth)) return { status: 401 };
  const modified = new Date(row.updated_at); modified.setMilliseconds(0);
  if (ifModifiedSince && Date.parse(ifModifiedSince) >= modified.getTime()) return { status: 304 };
  const p = await loadPassContent(row.application_id, { lang: row.lang }); if (!p) return { status: 404 };
  try { return { status: 200, file: await buildApplePass(cfg, p, row.serial, row.auth_token!, p.arrivalIso), lastModified: modified.toUTCString() }; }
  catch (e) { console.error("[wallet] apple pass failed", (e as Error).message); return { status: 500 }; }
}

// ---- updates after issue ----
/** Checks every pass that was handed out (oldest check first) and sends what changed: Google gets a PATCH, Apple phones get a push. A failure keeps the old fingerprint, so the next run tries again. */
export async function syncWalletPasses(o: { applicationId?: string; limit?: number } = {}): Promise<{ checked: number; updated: number; failed: number }> {
  let q = db().from("wallet_passes").select("id, application_id, platform, serial, lang, fingerprint").order("synced_at", { ascending: true }).limit(o.limit ?? 50);
  if (o.applicationId) q = q.eq("application_id", o.applicationId);
  const { data: rows } = await q; const out = { checked: 0, updated: 0, failed: 0 };
  const g = walletConfig(SITE_URL), a = appleConfig(SITE_URL);
  for (const r of rows ?? []) {
    out.checked++;
    try {
      const p = await loadPassContent(r.application_id, { lang: r.lang }); if (!p) continue;
      const fp = fingerprintOf(p), now = new Date().toISOString();
      if (fp === r.fingerprint) { await db().from("wallet_passes").update({ synced_at: now }).eq("id", r.id); continue; }
      if (r.platform === "google") { if (!g) continue; await patchObject(g, p, p.active); }
      else {
        if (!a) continue;
        await db().from("wallet_passes").update({ updated_at: now }).eq("id", r.id);                                       // the phones will see a newer tag
        const { data: regs } = await db().from("wallet_registrations").select("push_token").eq("pass_id", r.id);
        const res = await applePush(a, (regs ?? []).map((x) => x.push_token)); if (res.failed && !res.sent) throw new Error("apple push not accepted");
      }
      await db().from("wallet_passes").update({ fingerprint: fp, synced_at: now, last_error: null }).eq("id", r.id); out.updated++;
    } catch (e) {
      out.failed++; console.error("[wallet] sync failed", r.platform, (e as Error).message);
      await db().from("wallet_passes").update({ last_error: (e as Error).message.slice(0, 200), synced_at: new Date().toISOString() }).eq("id", r.id);
    }
  }
  return out;
}
