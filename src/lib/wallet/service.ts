import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { passToken } from "@/lib/passes";
import type { Dict } from "@/lib/i18n/dict/en";
import { saveUrl, walletConfig } from "./google";

/** The link for one application. Only the owner of an APPROVED (or used) application gets one, and only when Google Wallet is set up. */
export async function googleWalletLink(userId: string, applicationId: string, ctx: { t: Dict; lang: string; brandName: string }): Promise<{ ok: true; url: string } | { ok: false; error: "not_configured" | "not_found" }> {
  const cfg = walletConfig(SITE_URL); if (!cfg) return { ok: false, error: "not_configured" };
  const db = createAdminClient();
  const { data: a } = await db.from("applications").select("id, ref_no, trip_id, traveler_id").eq("id", applicationId).eq("owner_id", userId).in("status", ["approved", "used"]).maybeSingle();
  if (!a) return { ok: false, error: "not_found" };
  const [{ data: trip }, { data: tr }] = await Promise.all([
    db.from("trips").select("arrival_date, arrival_flight_no").eq("id", a.trip_id).maybeSingle(),
    db.from("travelers").select("given_name, surname, passport_last4").eq("id", a.traveler_id).maybeSingle(),
  ]);
  const { t, lang, brandName } = ctx;
  return { ok: true, url: saveUrl(cfg, {
    ref: a.ref_no, name: tr ? `${tr.given_name} ${tr.surname}`.slice(0, 60) : a.ref_no, brand: brandName, lang,
    arrival: trip ? new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(trip.arrival_date)) : null, flight: trip?.arrival_flight_no ?? null, passportLast4: tr?.passport_last4 ?? null,
    verifyUrl: `${SITE_URL}/v/${passToken(a.id)}`, logoUrl: `${SITE_URL}/brand/logo`,
    labels: { ref: t.pass_ref, arrival: t.apply_arrival_date, flight: t.apply_flight_no, passport: t.pass_passport_end, check: t.wallet_check, title: t.pass_title, notGov: t.wallet_not_gov },
  }) };
}
