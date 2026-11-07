import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { passToken } from "@/lib/passes";
import { loadBrand } from "@/lib/brand/server";
import { applyBrandName } from "@/lib/brand/brand";
import { DICTS } from "@/lib/i18n/dict";
import { isLang, type Lang } from "@/lib/i18n/langs";
import type { WalletPass } from "./google";

/** What a wallet pass shows for one application, in one language. The same content feeds the Google link, the Apple file and the update check. */
export type PassContent = WalletPass & { applicationId: string; active: boolean; arrivalIso: string | null };

/** Fingerprint of everything the pass shows: when it changes, the pass in the traveler's wallet is out of date. */
export const fingerprintOf = (p: PassContent) => createHash("sha256").update(JSON.stringify([p.ref, p.name, p.brand, p.lang, p.arrival, p.flight, p.passportLast4, p.active, p.status, p.verifyUrl, p.labels])).digest("hex");

const ACTIVE = ["approved", "used"];
/**
 * With `ownerId` (a traveler asking for their pass): only the owner of an approved or used application. Without it (the update job): any application,
 * and a pass whose application is no longer approved is shown as not valid.
 */
export async function loadPassContent(applicationId: string, o: { ownerId?: string; lang: string }): Promise<PassContent | null> {
  const db = createAdminClient();
  let q = db.from("applications").select("id, ref_no, status, trip_id, traveler_id").eq("id", applicationId);
  if (o.ownerId) q = q.eq("owner_id", o.ownerId).in("status", ACTIVE);
  const { data: a } = await q.maybeSingle();
  if (!a) return null;
  const [{ data: trip }, { data: tr }, brand] = await Promise.all([
    db.from("trips").select("arrival_date, arrival_flight_no").eq("id", a.trip_id).maybeSingle(),
    db.from("travelers").select("given_name, surname, passport_last4").eq("id", a.traveler_id).maybeSingle(),
    loadBrand(),
  ]);
  const lang: Lang = isLang(o.lang) ? o.lang : "en", t = DICTS[lang] as unknown as Record<string, string>, tx = (k: string) => applyBrandName(t[k] ?? k, brand.name);
  return {
    applicationId: a.id, arrivalIso: trip?.arrival_date ?? null, active: ACTIVE.includes(a.status), ref: a.ref_no, name: tr ? `${tr.given_name} ${tr.surname}`.slice(0, 60) : a.ref_no, brand: brand.name, lang,
    arrival: trip ? new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(trip.arrival_date)) : null, flight: trip?.arrival_flight_no ?? null, passportLast4: tr?.passport_last4 ?? null,
    status: tx(`st_${a.status}`), verifyUrl: `${SITE_URL}/v/${passToken(a.id)}`, logoUrl: `${SITE_URL}/brand/logo`,
    labels: { ref: tx("pass_ref"), arrival: tx("apply_arrival_date"), flight: tx("apply_flight_no"), passport: tx("pass_passport_end"), check: tx("wallet_check"), title: tx("pass_title"), notGov: tx("wallet_not_gov"), status: tx("wallet_status") },
  };
}
