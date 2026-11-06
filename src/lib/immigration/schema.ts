import { z } from "zod";

// Field names and limits follow the Immigration ICD (docket, getStatusById, getEVOAById, uploadAdditionalDocuments, updateStatusById).

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const hm = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM");

export const DocketDocument = z.object({
  DocumentListId: z.number().int(),
  FileContent: z.string().min(1),                       // base64
  FileName: z.string().min(1).max(50),
  MimeType: z.enum(["image/jpeg", "application/pdf"]),
  FileSize: z.string().max(10),                         // KB, as text
});
export type DocketDocument = z.infer<typeof DocketDocument>;

export const DocketApplicant = z.object({
  applicantDetails: z.object({
    paymentReceiptRefNumber: z.string().min(1).max(128),
    ApplicantName: z.string().min(1).max(100),
    Email: z.string().min(3).max(80),
    Mobile: z.string().min(3).max(12),
    IsPriority: z.union([z.literal(0), z.literal(1)]),
    ISDCode: z.string().min(1).max(9),
    NationalityId: z.number().int(),
  }),
  passportDetails: z.object({
    GivenName: z.string().min(1).max(255),
    SurName: z.string().min(1).max(255),
    MiddleName: z.string().max(255).optional(),
    PassportNumber: z.string().min(3).max(15),
    PassportExpiryDate: ymd,
    PassportIssueDate: ymd,
    DateOfBirth: ymd,
    ResidencyId: z.number().int(),
    GenderId: z.number().int(),
    SalutationId: z.number().int(),
    PassportTypeId: z.number().int(),
    PermanentAddress: z.string().min(1).max(100),
    State: z.string().min(1).max(100),
    YearlyIncome: z.number().int(),
    PlaceOfIssue: z.string().min(1).max(50),
    OccupationId: z.number().int(),
  }),
  travelDetails: z.object({
    ArrivalAirportId: z.number().int(),
    ArrivalDate: ymd,
    ArrivalTime: hm,
    ArrivalFlightNumber: z.string().min(1).max(50),
    ArrivalAirlinesId: z.number().int(),
    ArrivalPNRNumber: z.string().max(50).optional(),
    DepartureDate: ymd,
    DepartureTime: hm,
    DepartureFlightNumber: z.string().min(1).max(50),
    DepartureAirlinesId: z.number().int(),
    DeparturePNRNumber: z.string().max(50).optional(),
    PurposeOfVisit: z.number().int(),
    BoardedCountry: z.number().int(),
    NextCity: z.string().min(1).max(128),
    FirstTimeTraveller: z.union([z.literal(0), z.literal(1)]),
    TypeOfFlight: z.number().int(),
    LengthOfStay: z.string().min(1).max(2),
  }),
  accommodationDetails: z.object({
    PlaceOfStayId: z.number().int(),
    AccommodationOrOwnerName: z.string().min(1).max(50),
    CityId: z.number().int(),
    DistrictId: z.number().int(),
    SubDistrictId: z.number().int(),
    PinCode: z.string().min(1).max(10),
    StreetAddress: z.string().min(1).max(100),
    ReferenceDetails: z.string().min(1).max(50),
  }),
  documentList: z.array(DocketDocument).min(6).max(8),
});
export type DocketApplicant = z.infer<typeof DocketApplicant>;

export const Docket = z.object({
  batchReference: z.string().min(1).max(128),
  paymentBatchReference: z.string().min(1).max(128),
  NoOfApplicants: z.number().int().min(1),
  Amount: z.string().min(1).max(50),
  Applicants: z.array(DocketApplicant).min(1),
}).refine((d) => d.NoOfApplicants === d.Applicants.length, { message: "NoOfApplicants must equal the number of applicants" });
export type Docket = z.infer<typeof Docket>;

export const DocketResult = z.object({
  isSuccess: z.boolean(),
  errorDesc: z.string().optional().nullable(),
  totalSuccessCount: z.number().optional(),
  totalFailedCount: z.number().optional(),
  successList: z.array(z.object({ paymentReceiptRefNumber: z.string(), webReferenceNumber: z.string() })).default([]),
  failedList: z.array(z.object({ paymentReceiptRefNumber: z.string(), Reason: z.string().optional() })).default([]),
});
export type DocketResult = z.infer<typeof DocketResult>;

export const MasterItem = z.object({ Id: z.number().int(), Name: z.string(), Sequence: z.number().optional() }).passthrough();
export type MasterItem = z.infer<typeof MasterItem>;

/** What Immigration sends to us (updateStatusById). 1 = Approved, 2 = Rejected, 3 = NeedUpdate. */
export const StatusCallback = z.object({
  batchReference: z.string().min(1).max(128),
  webReferenceNumber: z.string().min(1).max(20),
  statusId: z.number().int(),
  statusDesc: z.string().max(200).nullish(),
  evoaContent: z.string().nullish(),             // base64, only when approved; may be null when only the status changes
});
export type StatusCallback = z.infer<typeof StatusCallback>;

export const MASTER_FLAT = [
  "salutation", "gender", "passportType", "occupation", "airlines", "arrivalAirport", "placeOfStay", "city",
  "purposeOfVisit", "yearlyIncome", "flightType", "nationality", "documentList",
] as const;
export type MasterName = (typeof MASTER_FLAT)[number] | "district" | "subDistrict";
