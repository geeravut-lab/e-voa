import type { Docket, DocketApplicant } from "./schema";

/** Sample data for tests (never real people). The passport suffix chooses what the simulator does: …APR, …REJ, …UPD, …SLOW, …DOWN, …ERR, …BAD. */
export const sampleDoc = (id: number, kb = 5): DocketApplicant["documentList"][number] => ({
  DocumentListId: id, FileContent: Buffer.alloc(kb * 1024, 1).toString("base64"), FileName: `doc${id}.jpg`, MimeType: "image/jpeg", FileSize: String(kb),
});

export function sampleApplicant(passport: string, paymentRef: string): DocketApplicant {
  return {
    applicantDetails: { paymentReceiptRefNumber: paymentRef, ApplicantName: "Anika Sharma", Email: "anika@example.com", Mobile: "912345678", IsPriority: 0, ISDCode: "+91", NationalityId: 1 },
    passportDetails: { GivenName: "Anika", SurName: "Sharma", PassportNumber: passport, PassportExpiryDate: "2031-03-08", PassportIssueDate: "2021-03-09", DateOfBirth: "1990-05-01", ResidencyId: 1, GenderId: 2, SalutationId: 2, PassportTypeId: 1, PermanentAddress: "Delhi", State: "Delhi", YearlyIncome: 2, PlaceOfIssue: "Delhi", OccupationId: 2 },
    travelDetails: { ArrivalAirportId: 1, ArrivalDate: "2026-12-14", ArrivalTime: "05:40", ArrivalFlightNumber: "TG316", ArrivalAirlinesId: 1, DepartureDate: "2026-12-26", DepartureTime: "09:00", DepartureFlightNumber: "TG317", DepartureAirlinesId: 1, PurposeOfVisit: 5, BoardedCountry: 1, NextCity: "Bangkok", FirstTimeTraveller: 1, TypeOfFlight: 2, LengthOfStay: "12" },
    accommodationDetails: { PlaceOfStayId: 1, AccommodationOrOwnerName: "Test Hotel", CityId: 1, DistrictId: 101, SubDistrictId: 1011, PinCode: "10330", StreetAddress: "1 Test Road", ReferenceDetails: "BK123" },
    documentList: [1, 2, 3, 4, 5, 6].map((i) => sampleDoc(i)),
  };
}

export const sampleDocket = (passport: string, paymentRef: string, batch = `batch-${paymentRef}`): Docket => ({
  batchReference: batch, paymentBatchReference: `pb-${paymentRef}`, NoOfApplicants: 1, Amount: "2000", Applicants: [sampleApplicant(passport, paymentRef)],
});
