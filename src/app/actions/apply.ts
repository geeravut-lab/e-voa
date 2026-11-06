"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFeature } from "@/lib/flags";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";
import { getLang } from "@/lib/i18n/server";
import { arrivalInstant, packageAvailability } from "@/lib/pricing";
import { lookupFlight, type FlightInfo } from "@/lib/flights";
import { createDraftApplication, resubmitAfterFix, saveApplicationDocument, upsertTraveler } from "@/lib/applications/service";
import { sendAdditionalDocuments } from "@/lib/immigration/pipeline";
import { gatewayFromEnv } from "@/lib/immigration/gateway";
import { setAddons } from "@/lib/partners/service";
import { startCheckout, failPayment } from "@/lib/payments/service";
import { ADDON_CATEGORIES, type AddonCategory } from "@/lib/partners/rules";
import { parseMrz } from "@/lib/mrz";
import type { ActionResult } from "@/components/ActionForm";

const need = async () => {
  const off = await assertFeature("apply");
  if (off) return { ok: false, error: off } as const;
  const v = await getViewer();
  if (!v.user) return { ok: false, error: "err_not_signed_in" } as const;
  return { ok: true, user: v.user, v } as const;
};
const num = z.coerce.number().int();
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hm = z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("").transform(() => undefined));
const str = (max: number) => z.string().trim().min(1).max(max);
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

/** Flight number + date → airline, airport and time (the form fills itself). Returns null when unknown or no provider is configured. */
export async function lookupFlightAction(flight: string, date: string): Promise<FlightInfo | null> {
  const a = await need(); if (!a.ok) return null;
  return lookupFlight(flight, date);
}

/** Reads the two MRZ lines typed or pasted (or produced by the on-device scanner) and returns the fields with their check digits. Nothing is stored. */
export async function readMrzAction(text: string) {
  const a = await need(); if (!a.ok) return null;
  const r = parseMrz(text.slice(0, 400));
  return r ? { ...r } : null;
}

// ------------------------------------------------------------------ step 1: trip + package
const TripSchema = z.object({
  tripId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  package: z.enum(["regular", "express"]),
  arrival_airport_id: num, arrival_date: iso, arrival_time: hm, arrival_flight_no: str(50), arrival_airline_id: num,
  departure_date: iso, departure_time: hm, departure_flight_no: str(50), departure_airline_id: num,
  purpose_id: num, boarded_country_id: num, next_city: str(128), type_of_flight_id: num.default(2),
});

export async function saveTripAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const p = TripSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "err_form_incomplete" };
  const d = p.data;
  if (d.departure_date < d.arrival_date) return { ok: false, error: "err_form_incomplete" };
  const av = packageAvailability(new Date(), arrivalInstant(d.arrival_date, d.arrival_time));
  if (!av[d.package]) return { ok: false, error: "err_package_unavailable" };
  const db = createAdminClient();
  const row = { owner_id: a.user.id, package: d.package, arrival_airport_id: d.arrival_airport_id, arrival_date: d.arrival_date, arrival_time: d.arrival_time ?? null, arrival_flight_no: d.arrival_flight_no.toUpperCase(), arrival_airline_id: d.arrival_airline_id,
    departure_date: d.departure_date, departure_time: d.departure_time ?? null, departure_flight_no: d.departure_flight_no.toUpperCase(), departure_airline_id: d.departure_airline_id, purpose_id: d.purpose_id, boarded_country_id: d.boarded_country_id, next_city: d.next_city, type_of_flight_id: d.type_of_flight_id };
  let tripId = d.tripId;
  if (tripId) {
    const upd = await db.from("trips").update(row).eq("id", tripId).eq("owner_id", a.user.id).select("id");
    if (upd.data?.length !== 1) return { ok: false, error: "err_not_found" };
    // the package is part of every application of this trip: keep them in step while they are still drafts
    await db.from("applications").update({ package: d.package }).eq("trip_id", tripId).eq("status", "draft");
  } else {
    const ins = await db.from("trips").insert(row).select("id").single();
    if (ins.error || !ins.data) return { ok: false, error: "err_generic" };
    tripId = ins.data.id; void trackEvent(a.user.id, "apply_start");
  }
  redirect(`/apply?step=2&trip=${tripId}`);
}

// ------------------------------------------------------------------ step 2: traveler, form, documents
const TravelerSchema = z.object({
  tripId: z.string().uuid(), appId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)), travelerId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  given_name: str(100), middle_name: opt(100), surname: str(100), gender_id: num, salutation_id: num, date_of_birth: iso, nationality_id: num,
  passport_no: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,15}$/), passport_issue_date: iso, passport_expiry_date: iso, passport_place_of_issue: str(50),
  email: z.string().trim().email().max(80), phone: str(12), isd_code: str(9),
  residency_id: num, permanent_address: str(100), state: str(100), yearly_income_id: num, occupation_id: num,
  place_of_stay_id: num, stay_name: str(50), city_id: num, district_id: num, sub_district_id: num, pin_code: str(10), street: str(100), reference: str(50),
  first_time_traveller: z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).default(1),
});

export async function saveTravelerAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const p = TravelerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "err_form_incomplete" };
  const d = p.data; const db = createAdminClient();
  const { data: trip } = await db.from("trips").select("id, package").eq("id", d.tripId).eq("owner_id", a.user.id).maybeSingle();
  if (!trip?.package) return { ok: false, error: "err_not_found" };
  const t = await upsertTraveler(a.user.id, { id: d.travelerId, given_name: d.given_name, middle_name: d.middle_name, surname: d.surname, gender_id: d.gender_id, salutation_id: d.salutation_id, date_of_birth: d.date_of_birth, nationality_id: d.nationality_id,
    passport_no: d.passport_no, passport_issue_date: d.passport_issue_date, passport_expiry_date: d.passport_expiry_date, passport_place_of_issue: d.passport_place_of_issue, email: d.email, phone: d.phone });
  if (!t.ok) return { ok: false, error: t.error };
  const app = await createDraftApplication(a.user.id, { tripId: d.tripId, travelerId: t.id, pkg: trip.package, form: {
    residency_id: d.residency_id, permanent_address: d.permanent_address, state: d.state, yearly_income_id: d.yearly_income_id, occupation_id: d.occupation_id, isd_code: d.isd_code, mobile: d.phone, email: d.email, first_time_traveller: d.first_time_traveller,
    stay: { place_of_stay_id: d.place_of_stay_id, name: d.stay_name, city_id: d.city_id, district_id: d.district_id, sub_district_id: d.sub_district_id, pin_code: d.pin_code, street: d.street, reference: d.reference } } });
  if (!app.ok) return { ok: false, error: app.error };
  revalidatePath("/apply");
  redirect(`/apply?step=2&trip=${d.tripId}&app=${app.id}`);
}

export async function uploadDocumentAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const appId = String(fd.get("appId") ?? ""), kind = String(fd.get("kind") ?? ""), file = fd.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(appId)) return { ok: false, error: "err_not_found" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "err_file_missing" };
  const r = await saveApplicationDocument(a.user.id, appId, kind, new Uint8Array(await file.arrayBuffer()));
  if (!r.ok) return r;
  revalidatePath("/apply"); revalidatePath(`/trips/${appId}`);
  return { ok: true };
}

export async function removeApplicationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const appId = String(fd.get("appId") ?? ""), trip = String(fd.get("tripId") ?? "");
  const { data, error } = await createAdminClient().rpc("transition_application", { p_id: appId, p_to: "cancelled", p_reason: "removed by traveler", p_source: "user", p_actor: a.user.id, p_only_from: ["draft"] });
  if (error || (data as { status?: string } | null)?.status !== "cancelled") return { ok: false, error: "err_locked" };
  revalidatePath("/apply"); redirect(`/apply?step=2&trip=${trip}`);
}

// ------------------------------------------------------------------ step 3: extras
export async function saveAddonsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const tripId = String(fd.get("tripId") ?? "");
  const { data: apps } = await createAdminClient().from("applications").select("id").eq("trip_id", tripId).eq("owner_id", a.user.id).eq("status", "draft");
  for (const app of apps ?? []) {
    const picks: { category: AddonCategory; packageCode: string }[] = [];
    for (const c of ADDON_CATEGORIES) { const v = String(fd.get(`addon:${app.id}:${c}`) ?? ""); if (v) picks.push({ category: c, packageCode: v }); }
    const r = await setAddons(a.user.id, app.id, picks);
    if (!r.ok) return r;
  }
  revalidatePath("/apply"); redirect(`/apply?step=4&trip=${tripId}`);
}

// ------------------------------------------------------------------ step 4: pay
export async function checkoutAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const r = await startCheckout(a.user.id, a.user.email ?? null, String(fd.get("tripId") ?? ""), await getLang());
  if (!r.ok) return { ok: false, error: r.error };
  redirect(r.url);
}

export async function cancelPaymentAction(paymentId: string): Promise<void> {
  const a = await need(); if (!a.ok) return;
  const { data } = await createAdminClient().from("payments").select("id").eq("id", paymentId).eq("owner_id", a.user.id).maybeSingle();
  if (data) await failPayment(paymentId, "cancelled by traveler");
}

// ------------------------------------------------------------------ after submission
/** Fixing what the pre-check found: back to pre_check and run again. If Immigration asked for more, send the additional documents instead. */
export async function resubmitAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = await need(); if (!a.ok) return { ok: false, error: a.error };
  const appId = String(fd.get("appId") ?? "");
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, immigration_ref, status").eq("id", appId).eq("owner_id", a.user.id).maybeSingle();
  if (!app) return { ok: false, error: "err_not_found" };
  if (app.immigration_ref) {                                                          // Immigration asked for more documents
    const gw = gatewayFromEnv(); if (!gw) return { ok: false, error: "err_not_configured" };
    const r = await sendAdditionalDocuments(gw, app.id); if (!r.ok) return r;
  } else { const r = await resubmitAfterFix(a.user.id, app.id); if (!r.ok) return r; }
  await audit({ actorId: a.user.id, action: "application.resubmit", entity: "application", entityId: app.id });
  revalidatePath(`/trips/${app.id}`); revalidatePath("/trips");
  return { ok: true };
}
