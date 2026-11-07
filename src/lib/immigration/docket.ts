import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptText } from "@/lib/crypto";
import { decryptBytes } from "@/lib/crypto";
import { Docket, type DocketApplicant } from "./schema";
import { ApplicationForm, stayDays } from "./form";

export class DocketBuildError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export type AppRow = {
  id: string; ref_no: string; owner_id: string; trip_id: string; traveler_id: string; package: "regular" | "express"; status: string;
  form: unknown; visa_fee_thb: number; service_fee_thb: number; batch_reference: string | null; payment_receipt_ref: string | null; immigration_ref: string | null;
};

/** Turns a document row into the shape Immigration wants (base64 of the DECRYPTED file). Only JPEG and PDF are accepted by Immigration. */
const PLACEHOLDER_JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
/** `lenient` is for the built-in simulator only: a file or number that cannot be decrypted (the key was changed) is replaced by a placeholder so the journey can still be tried. A real send is never lenient. */
export async function loadDocketDocuments(applicationId: string, kinds: string[], lenient = false): Promise<DocketApplicant["documentList"]> {
  const db = createAdminClient();
  const { data, error } = await db.from("documents").select("id, doc_list_id, storage_path, mime, kind, created_at").eq("application_id", applicationId).is("deleted_at", null).in("kind", kinds).order("created_at");
  if (error) throw new DocketBuildError("err_generic", error.message);
  const out: DocketApplicant["documentList"] = [];
  for (const d of data ?? []) {
    if (d.mime !== "image/jpeg" && d.mime !== "application/pdf") throw new DocketBuildError("err_doc_format", `document ${d.id} is ${d.mime}; Immigration accepts JPEG or PDF`);
    if (!d.doc_list_id) throw new DocketBuildError("err_doc_type", `document ${d.id} has no Immigration document type`);
    const dl = await db.storage.from("documents").download(d.storage_path);
    if (dl.error || !dl.data) throw new DocketBuildError("err_generic", `cannot read document ${d.id}`);
    let bytes: Buffer;
    try { bytes = decryptBytes(new Uint8Array(await dl.data.arrayBuffer())); } catch (e) { if (!lenient) throw e; bytes = PLACEHOLDER_JPEG; }
    out.push({
      DocumentListId: d.doc_list_id, FileContent: bytes.toString("base64"),
      FileName: `${d.kind}-${d.id.slice(0, 8)}.${d.mime === "application/pdf" ? "pdf" : "jpg"}`.slice(0, 50), MimeType: d.mime as "image/jpeg" | "application/pdf", FileSize: String(Math.ceil(bytes.length / 1024)),
    });
  }
  return out;
}

/** Collects everything about one application from the database and returns a docket that already passed our own validation. */
export async function buildDocket(app: AppRow, lenient = false): Promise<Docket> {
  if (!app.payment_receipt_ref) throw new DocketBuildError("err_not_paid", "application has no payment reference yet");
  const db = createAdminClient();
  const [{ data: trip }, { data: t }] = await Promise.all([
    db.from("trips").select("*").eq("id", app.trip_id).maybeSingle(),
    db.from("travelers").select("*").eq("id", app.traveler_id).maybeSingle(),
  ]);
  if (!trip || !t) throw new DocketBuildError("err_not_found", "trip or traveler is missing");
  const form = ApplicationForm.safeParse(app.form);
  if (!form.success) throw new DocketBuildError("err_form_incomplete", form.error.issues.map((i) => i.path.join(".")).join(", "));
  const f = form.data;
  if (!t.passport_no_enc) throw new DocketBuildError("err_form_incomplete", "passport number is missing");
  let passport: string;
  try { passport = decryptText(t.passport_no_enc); } catch (e) { if (!lenient) throw e; passport = "SIM000000"; }
  const docs = await loadDocketDocuments(app.id, ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance", "other"], lenient);

  const applicant: DocketApplicant = {
    applicantDetails: {
      paymentReceiptRefNumber: app.payment_receipt_ref,
      ApplicantName: `${t.given_name} ${t.surname}`.slice(0, 100), Email: f.email, Mobile: f.mobile, IsPriority: app.package === "express" ? 1 : 0, ISDCode: f.isd_code, NationalityId: t.nationality_id,
    },
    passportDetails: {
      GivenName: t.given_name, SurName: t.surname, ...(t.middle_name ? { MiddleName: t.middle_name } : {}), PassportNumber: passport,
      PassportExpiryDate: t.passport_expiry_date, PassportIssueDate: t.passport_issue_date, DateOfBirth: t.date_of_birth,
      ResidencyId: f.residency_id, GenderId: t.gender_id, SalutationId: t.salutation_id, PassportTypeId: f.passport_type_id,
      PermanentAddress: f.permanent_address, State: f.state, YearlyIncome: f.yearly_income_id, PlaceOfIssue: t.passport_place_of_issue, OccupationId: f.occupation_id,
    },
    travelDetails: {
      ArrivalAirportId: trip.arrival_airport_id, ArrivalDate: trip.arrival_date, ArrivalTime: trip.arrival_time, ArrivalFlightNumber: trip.arrival_flight_no, ArrivalAirlinesId: trip.arrival_airline_id,
      ...(trip.arrival_pnr ? { ArrivalPNRNumber: trip.arrival_pnr } : {}),
      DepartureDate: trip.departure_date, DepartureTime: trip.departure_time, DepartureFlightNumber: trip.departure_flight_no, DepartureAirlinesId: trip.departure_airline_id,
      ...(trip.departure_pnr ? { DeparturePNRNumber: trip.departure_pnr } : {}),
      PurposeOfVisit: trip.purpose_id, BoardedCountry: trip.boarded_country_id, NextCity: trip.next_city, FirstTimeTraveller: f.first_time_traveller, TypeOfFlight: trip.type_of_flight_id,
      LengthOfStay: String(f.length_of_stay ?? stayDays(trip.arrival_date, trip.departure_date) ?? ""),
    },
    accommodationDetails: {
      PlaceOfStayId: f.stay.place_of_stay_id, AccommodationOrOwnerName: f.stay.name, CityId: f.stay.city_id, DistrictId: f.stay.district_id, SubDistrictId: f.stay.sub_district_id,
      PinCode: f.stay.pin_code, StreetAddress: f.stay.street, ReferenceDetails: f.stay.reference,
    },
    documentList: docs,
  };
  const batch = app.batch_reference ?? `B-${app.ref_no}`;
  const parsed = Docket.safeParse({ batchReference: batch, paymentBatchReference: `PB-${app.ref_no}`, NoOfApplicants: 1, Amount: String(app.visa_fee_thb), Applicants: [applicant] });
  if (!parsed.success) throw new DocketBuildError("err_form_incomplete", parsed.error.issues.slice(0, 5).map((i) => i.path.join(".") + ": " + i.message).join("; "));
  return parsed.data;
}
