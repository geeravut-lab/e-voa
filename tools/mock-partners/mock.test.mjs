import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createMockServer, signPartner } from "./server.mjs";

let mock, base, cap, capBase;
const received = [];
const IMM = { Authorization: "jwt-token", From: "thaipass", "Content-Type": "application/json" };
const partnerHeaders = (secret = "mock-secret", key = "mock-public") => { const ts = "20261106101500"; return { "X-API-KEY": signPartner(secret, ts), timestamp: ts, key, "Content-Type": "application/json" }; };
const call = async (path, { method = "GET", headers = {}, body } = {}) => { const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
const doc = (id, kb = 5) => ({ DocumentListId: id, FileContent: Buffer.alloc(kb * 1024, 1).toString("base64"), FileName: `doc${id}.jpg`, MimeType: "image/jpeg", FileSize: String(kb) });
function applicant(pass, pay) {
  return {
    applicantDetails: { paymentReceiptRefNumber: pay, ApplicantName: "Anika Sharma", Email: "a@example.com", Mobile: "912345678", IsPriority: 0, ISDCode: "+91", NationalityId: 1 },
    passportDetails: { GivenName: "Anika", SurName: "Sharma", PassportNumber: pass, PassportExpiryDate: "2031-03-08", PassportIssueDate: "2021-03-09", DateOfBirth: "1990-05-01", ResidencyId: 1, GenderId: 2, SalutationId: 2, PassportTypeId: 1, PermanentAddress: "Delhi", State: "Delhi", YearlyIncome: 2, PlaceOfIssue: "Delhi", OccupationId: 2 },
    travelDetails: { ArrivalAirportId: 1, ArrivalDate: "2026-12-14", ArrivalTime: "05:40", ArrivalFlightNumber: "TG316", ArrivalAirlinesId: 1, DepartureDate: "2026-12-26", DepartureTime: "09:00", DepartureFlightNumber: "TG317", DepartureAirlinesId: 1, PurposeOfVisit: 5, BoardedCountry: 1, NextCity: "Bangkok", FirstTimeTraveller: 1, TypeOfFlight: 2, LengthOfStay: "12" },
    accommodationDetails: { PlaceOfStayId: 1, AccommodationOrOwnerName: "Test Hotel", CityId: 1, DistrictId: 101, SubDistrictId: 1011, PinCode: "10330", StreetAddress: "1 Test Road", ReferenceDetails: "BK123" },
    documentList: [doc(1), doc(2), doc(3), doc(4), doc(5), doc(6)],
  };
}
const docket = (pass, pay, batch = `b-${pay}`) => ({ batchReference: batch, paymentBatchReference: `pb-${pay}`, NoOfApplicants: 1, Amount: "2000", Applicants: [applicant(pass, pay)] });

beforeAll(async () => {
  cap = createServer((req, res) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => { received.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") }); res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); }); });
  await new Promise((r) => cap.listen(0, r)); capBase = `http://127.0.0.1:${cap.address().port}`;
  mock = createMockServer({ decisionDelayMs: 40, log: () => {}, callbacks: { immigration: capBase + "/imm", insurance: capBase + "/ins", sim: capBase + "/sim", vip: capBase + "/vip", bhs: capBase + "/bhs" } });
  base = `http://127.0.0.1:${await mock.listen(0)}`;
});
afterAll(async () => { await mock.close(); await new Promise((r) => cap.close(r)); });
beforeEach(() => { received.length = 0; });

describe("Immigration: auth and master data", () => {
  it("refuses calls without the Authorization and From headers", async () => {
    expect((await call("/immigration/th/v1/master/gender")).status).toBe(401);
    expect((await call("/immigration/th/v1/master/gender", { headers: { Authorization: "x" } })).status).toBe(401);
  });
  it("serves the master lists in the Name/Id/Sequence shape", async () => {
    const r = await call("/immigration/th/v1/master/salutation", { headers: IMM });
    expect(r.json).toMatchObject({ status: 200, message: "Success" });
    expect(r.json.result[0]).toEqual({ Name: "Mr", Id: 1, Sequence: 1 });
    for (const n of ["gender", "passportType", "occupation", "airlines", "arrivalAirport", "placeOfStay", "city", "purposeOfVisit", "yearlyIncome", "flightType", "nationality", "documentList"])
      expect((await call(`/immigration/th/v1/master/${n}`, { headers: IMM })).json.result.length, n).toBeGreaterThan(0);
    expect((await call("/immigration/th/v1/master/nationality", { headers: IMM })).json.result[0]).toHaveProperty("CountryCode");
  });
  it("serves districts and sub-districts and 404s unknown names", async () => {
    expect((await call("/immigration/th/v1/master/district/1", { headers: IMM })).json.result.length).toBeGreaterThan(0);
    expect((await call("/immigration/th/v1/master/subDistrict/101", { headers: IMM })).json.result.length).toBeGreaterThan(0);
    expect((await call("/immigration/th/v1/master/nope", { headers: IMM })).status).toBe(404);
  });
});

describe("Immigration: docket validation", () => {
  it("refuses malformed bodies", async () => {
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: "{not json" })).status).toBe(400);
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: { batchReference: "x" } })).status).toBe(400);
  });
  it("lists a failed applicant with the reason instead of accepting it", async () => {
    const d = docket("P1000001", "pay-miss"); delete d.Applicants[0].passportDetails.DateOfBirth;
    const r = await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: d });
    expect(r.json.result.totalFailedCount).toBe(1);
    expect(r.json.result.failedList[0]).toMatchObject({ paymentReceiptRefNumber: "pay-miss" });
    expect(r.json.result.failedList[0].Reason).toContain("DateOfBirth");
  });
  it("enforces 6–8 documents, mime type and size limits (photo ≤ 100 KB)", async () => {
    const few = docket("P1000002", "pay-few"); few.Applicants[0].documentList.pop();
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: few })).json.result.failedList[0].Reason).toContain("6 to 8");
    const big = docket("P1000003", "pay-big"); big.Applicants[0].documentList[1] = doc(2, 150);
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: big })).json.result.failedList[0].Reason).toContain("limit");
    const mime = docket("P1000004", "pay-mime"); mime.Applicants[0].documentList[0].MimeType = "image/png";
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: mime })).json.result.failedList[0].Reason).toContain("MimeType");
  });
});

describe("Immigration: decisions by passport number", () => {
  const submit = async (pass, pay) => (await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: docket(pass, pay) })).json.result;
  it("approves, calls back with the E-VOA, and answers status and download", async () => {
    const r = await submit("P2000APR", "pay-ok"); const web = r.successList[0].webReferenceNumber;
    expect(web).toMatch(/^W/); expect(web.length).toBeLessThanOrEqual(15);
    const cb = await until(() => received.find((x) => x.url === "/imm" && x.body.webReferenceNumber === web));
    expect(cb).toBeTruthy(); expect(cb.auth).toBe("Bearer mock-callback-secret");
    expect(cb.body).toMatchObject({ statusId: 1, batchReference: "b-pay-ok" }); expect(Buffer.from(cb.body.evoaContent, "base64").toString()).toContain("%PDF");
    const st = await call(`/immigration/th/v1/application/getStatusById?webReferenceNumber=${web}&paymentReceiptRefNumber=pay-ok`, { headers: IMM });
    expect(st.json.result).toMatchObject({ isSuccess: true, Status: "Approved" });
    const ev = await call(`/immigration/th/v1/application/getEVOAById?webReferenceNumber=${web}&paymentReceiptRefNumber=pay-ok`, { headers: IMM });
    expect(ev.json.result.isSuccess).toBe(true); expect(ev.json.result.evoaContent.length).toBeGreaterThan(10);
  });
  it("rejects with a reason", async () => {
    const web = (await submit("P2000REJ", "pay-rej")).successList[0].webReferenceNumber;
    const cb = await until(() => received.find((x) => x.body.webReferenceNumber === web));
    expect(cb.body).toMatchObject({ statusId: 2, statusDesc: expect.stringContaining("Blacklist") }); expect(cb.body.evoaContent).toBeNull();
  });
  it("asks for an update, accepts additional documents, then approves", async () => {
    const web = (await submit("P2000UPD", "pay-upd")).successList[0].webReferenceNumber;
    const need = await until(() => received.find((x) => x.body.webReferenceNumber === web && x.body.statusId === 3)); expect(need).toBeTruthy();
    const up = await call("/immigration/th/v1/application/uploadAdditionalDocuments", { method: "POST", headers: IMM, body: { batchReference: "b-pay-upd", paymentReceiptNumber: "pay-upd", webReferenceNumber: web, documentList: [doc(4)] } });
    expect(up.json.result.isSuccess).toBe(true);
    expect(await until(() => received.find((x) => x.body.webReferenceNumber === web && x.body.statusId === 1))).toBeTruthy();
    const six = await call("/immigration/th/v1/application/uploadAdditionalDocuments", { method: "POST", headers: IMM, body: { batchReference: "b", paymentReceiptNumber: "pay-upd", webReferenceNumber: web, documentList: [1, 2, 3, 4, 5, 6].map((i) => doc(4)) } });
    expect(six.json.result.isSuccess).toBe(false);
  });
  it("waits for a manual decision when the passport ends in SLOW", async () => {
    const web = (await submit("P2000SLOW", "pay-slow")).successList[0].webReferenceNumber; await new Promise((r) => setTimeout(r, 150));
    expect(received.find((x) => x.body.webReferenceNumber === web)).toBeUndefined();
    expect((await call("/__admin/decide", { method: "POST", body: { webReferenceNumber: web, statusId: 1 } })).json.ok).toBe(true);
    expect(received.find((x) => x.body.webReferenceNumber === web)?.body.statusId).toBe(1);
  });
  it("simulates outages: DOWN = 503, ERR = one 500 then success", async () => {
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: docket("P2000DOWN", "pay-down") })).status).toBe(503);
    const d = docket("P2000ERR", "pay-err", "b-err");
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: d })).status).toBe(500);
    expect((await call("/immigration/th/v1/application/docket", { method: "POST", headers: IMM, body: d })).json.result.totalSuccessCount).toBe(1);
  });
  it("is idempotent for the same payment reference (default) or rejects it (reject mode)", async () => {
    const a = (await submit("P2000DUP", "pay-dup")).successList[0].webReferenceNumber; const b = (await submit("P2000DUP", "pay-dup")).successList[0].webReferenceNumber; expect(b).toBe(a);
    await call("/__admin/config", { method: "POST", body: { duplicateMode: "reject" } });
    expect((await submit("P2000DUP", "pay-dup")).failedList[0].Reason).toContain("Duplicate");
    await call("/__admin/config", { method: "POST", body: { duplicateMode: "idempotent" } });
  });
  it("reports unknown applications without crashing", async () => {
    const r = await call("/immigration/th/v1/application/getStatusById?webReferenceNumber=NOPE&paymentReceiptRefNumber=x", { headers: IMM });
    expect(r.json.result.isSuccess).toBe(false);
  });
});

describe("Partners: signature and packages", () => {
  it("refuses a bad signature or public key", async () => {
    expect((await call("/sim/wechat/package_list?category=SIM&lang=EN", { headers: partnerHeaders("wrong") })).status).toBe(401);
    expect((await call("/sim/wechat/package_list?category=SIM&lang=EN", { headers: partnerHeaders("mock-secret", "bad") })).status).toBe(401);
    expect((await call("/sim/wechat/package_list?category=SIM&lang=EN")).status).toBe(401);
  });
  it("lists packages with THB, USD and CNY prices", async () => {
    for (const [path, cat] of [["/sim/wechat/package_list", "SIM"], ["/sim/wechat/package_list", "ESIM"], ["/vip/wechat/package_list", "SERVICE"], ["/bhs/wechat/package_list", "HEALTH"]]) {
      const r = await call(`${path}?category=${cat}&lang=EN`, { headers: partnerHeaders() });
      expect(r.json.status, cat).toBe(0); expect(r.json.result.length, cat).toBeGreaterThan(0);
      expect(r.json.result[0]).toHaveProperty("package_price_thb"); expect(r.json.result[0]).toHaveProperty("package_price_usd"); expect(r.json.result[0]).toHaveProperty("package_price_cny"); expect(r.json.result[0].package_category).toBe(cat);
    }
  });
});

const simBody = (pkg, extra = {}) => ({ PaymentReceiptRefNumber: "pay-s1", WebReferenceNumber: "W1", GivenName: "Anika", SurName: "Sharma", PassportNumber: "P3000001", ArrivalAirportId: 1, ArrivalDate: "2026-12-14", ArrivalTime: "05:40", ArrivalFlightNumber: "TG316", ArrivalAirlinesId: 1, PackageCode: pkg, PackagePriceTHB: 600, ...extra });
describe("SIM and eSIM", () => {
  it("sells a physical SIM (needs the passport bio page) and reports pick-up", async () => {
    expect((await call("/sim/SIM/TRUE/sim_buy", { method: "POST", headers: partnerHeaders(), body: simBody("SVR-002") })).json.status).toBe(1);
    const r = await call("/sim/SIM/TRUE/sim_buy", { method: "POST", headers: partnerHeaders(), body: simBody("SVR-002", { bioImage: "AAAA" }) });
    expect(r.json.status).toBe(0); const id = r.json.result.TransactionID; expect(id).toMatch(/^SIM-01_TRN/);
    await call("/__admin/partner/sim-confirm", { method: "POST", body: { TransactionID: id } });
    expect(received.find((x) => x.url === "/sim/SIM/TRUE/sim_confirm")?.body).toMatchObject({ TransactionID: id, PassportNumber: "P3000001" });
  });
  it("sells an eSIM and returns the activation QR", async () => {
    const r = await call("/sim/SIM/TRUE/sim_buy", { method: "POST", headers: partnerHeaders(), body: simBody("ESIM-015") });
    expect(r.json.status).toBe(0); expect(r.json.result.TransactionID).toMatch(/^ESIM-01_TRN/); expect(r.json.result.esim.lpa).toContain("LPA:1$");
  });
  it("refuses unknown packages and missing fields", async () => {
    expect((await call("/sim/SIM/TRUE/sim_buy", { method: "POST", headers: partnerHeaders(), body: simBody("NOPE") })).json.status).toBe(1);
    expect((await call("/sim/SIM/TRUE/sim_buy", { method: "POST", headers: partnerHeaders(), body: { PackageCode: "ESIM-015" } })).json.message).toContain("Missing");
  });
});

describe("VIP services", () => {
  it("sells a package and reports that it was used", async () => {
    const body = { PaymentReceiptRefNumber: "pay-v1", WebReferenceNumber: "W2", GivenName: "Anika", SurName: "Sharma", PassportNumber: "P4000001", ArrivalAirportId: 1, ArrivalDate: "2026-12-14", ArrivalTime: "05:40", ArrivalFlightNumber: "TG316", PackageCode: "SVR-010", PackagePriceTHB: 2000 };
    const r = await call("/vip/Services/VIP/vip_buy", { method: "POST", headers: partnerHeaders(), body }); expect(r.json.status).toBe(0);
    const id = r.json.result.TransactionID; await call("/__admin/partner/vip-confirm", { method: "POST", body: { TransactionID: id, ConfirmBy: "Emerald" } });
    expect(received.find((x) => x.url === "/vip/Services/VIP/vip_confirm")?.body).toMatchObject({ TransactionID: id, ConfirmBy: "Emerald" });
  });
});

describe("Beauty and health", () => {
  const voucherBody = { packageCode: "HEALTH-CHK-01", PaymentReceiptRefNumber: "pay-h1", WebReferenceNumber: "W3", GivenName: "Anika", SurName: "Sharma", PassportNumber: "P5000001", DateOfBirth: "1990-05-01", Email: "a@example.com", Mobile: "912345678", ArrivalDate: "2026-12-14" };
  it("issues a voucher, verifies it, then confirms use and sends the result", async () => {
    const r = await call("/bhs/wechat/gen_health_voucher", { method: "POST", headers: partnerHeaders(), body: voucherBody }); expect(r.json.status).toBe(0);
    const code = r.json.result.voucherCode; expect(code).toHaveLength(32);
    expect((await call("/bhs/wechat/voucher/verify", { method: "POST", headers: partnerHeaders(), body: { VoucherCode: code } })).json.result.state).toBe("VALID");
    await call("/__admin/partner/bhs-confirm", { method: "POST", body: { VoucherCode: code } });
    expect((await call("/bhs/wechat/voucher/verify", { method: "POST", headers: partnerHeaders(), body: { VoucherCode: code } })).json.result.state).toBe("USED");
    await call("/__admin/partner/bhs-result", { method: "POST", body: { VoucherCode: code, LabReportResult: "Normal" } });
    expect(received.find((x) => x.url === "/bhs/wechat/voucher/confirm_voucher")?.body.VoucherCode).toBe(code);
    expect(received.find((x) => x.url === "/bhs/wechat/voucher/callback_result")?.body.LabReportResult).toBe("Normal");
    expect((await call("/bhs/wechat/voucher/verify", { method: "POST", headers: partnerHeaders(), body: { VoucherCode: "unknown" } })).json.result.state).toBe("INVALID");
  });
});

describe("Insurance (CIS)", () => {
  const policy = (RequestNo) => ({ RequestNo, CountryName: "THAILAND", PlanCode: "GTA0501", PolicyUnit: "D", PolicyType: "I", PolicyDate: "14/12/2026", ExpiryDate: "26/12/2026", NumberPerson: "1", NetAmount: "45", Amount: "41.06", CustomerType: "P", CustomerPrefix: "MISS", CustomerName: "Anika", CustomerSureName: "Sharma", CardType: "P", IdCard: "P6000001", Email: "a@example.com", InsurePrefix: "MISS", InsureName: "Anika", InsureSurName: "Sharma", InsureCardType: "P", InsureIdCard: "P6000001", InsureEmail: "a@example.com", Address1: "India" });
  const auth = { "g-api-key": "k", Authorization: "Bearer t", "Content-Type": "application/json" };
  it("needs the key and bearer token", async () => expect((await call("/insurance/CIS/travelPAPolicyIssueService", { method: "POST", body: policy("R0") })).status).toBe(401));
  it("issues a policy and calls Confirm_COI with the e-card", async () => {
    const r = await call("/insurance/CIS/travelPAPolicyIssueService", { method: "POST", headers: auth, body: policy("RQ1") });
    expect(r.json).toMatchObject({ status: "success", data: { RequestNo: "RQ1", policy_status: "SUCCESS" } });
    const cb = await until(() => received.find((x) => x.url === "/ins/Confirm_COI"));
    expect(cb.body).toMatchObject({ RequestNo: "RQ1", policy_no: r.json.data.policy_no }); expect(cb.body.ecard_url).toContain("ecard");
  });
  it("answers validation errors in the documented shape, also for form-encoded bodies", async () => {
    const bad = policy("RQ2"); delete bad.Email;
    const r = await call("/insurance/CIS/travelPAPolicyIssueService", { method: "POST", headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(bad).toString() });
    expect(r.json.status).toBe("error"); expect(r.json.data.Email[0]).toContain("required"); expect(r.json["0"]).toBe("Validation Error");
    expect((await call("/insurance/CIS/travelPAPolicyIssueService", { method: "POST", headers: auth, body: { ...policy("RQ3"), PlanCode: "X" } })).json.data.PlanCode).toBeTruthy();
  });
});

describe("Flight lookup and insurance files", () => {
  it("looks up a flight and refuses unknown ones", async () => {
    const ok = await call("/flights/lookup?flight=TG316&date=2026-12-14");
    expect(ok.json).toMatchObject({ flight: "TG316", airline: { iata: "TG" }, arrival: { iata: "BKK" } }); expect(ok.json.arrival.scheduledLocal).toMatch(/^\d{2}:\d{2}$/);
    expect((await call("/flights/lookup?flight=ZZ1&date=2026-12-14")).status).toBe(404);
    expect((await call("/flights/lookup?flight=TG316&date=14-12-2026")).status).toBe(404);
  });
  it("serves the policy and e-card files the insurance callback points to", async () => {
    const auth = { "g-api-key": "k", Authorization: "Bearer t", "Content-Type": "application/json" };
    const body = { RequestNo: "RQ-FILES", CountryName: "THAILAND", PlanCode: "GTA0501", PolicyUnit: "D", PolicyType: "I", PolicyDate: "14/12/2026", ExpiryDate: "26/12/2026", NumberPerson: "1", NetAmount: "45", Amount: "41", CustomerType: "P", CustomerPrefix: "MISS", CustomerName: "A", CustomerSureName: "B", CardType: "P", IdCard: "P1", Email: "a@b.co", InsurePrefix: "MISS", InsureName: "A", InsureSurName: "B", InsureCardType: "P", InsureIdCard: "P1", InsureEmail: "a@b.co", Address1: "X" };
    const r = await call("/insurance/CIS/travelPAPolicyIssueService", { method: "POST", headers: auth, body });
    const pdf = await fetch(r.json.data.policy_url); expect(pdf.status).toBe(200); expect((await pdf.text()).startsWith("%PDF")).toBe(true);
    const cb = await until(() => received.find((x) => x.url === "/ins/Confirm_COI" && x.body.RequestNo === "RQ-FILES")); expect(cb).toBeTruthy();
    expect((await fetch(cb.body.ecard_url)).headers.get("content-type")).toBe("image/png");
  });
});
