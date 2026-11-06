import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { applicationFees, arrivalInstant, buildLineItems, packageAvailability, parseFees, toSatang, totalThb } from "./pricing";
import { checkEligibility, parseEligibility } from "./eligibility";
import { checkDigit, normalizeMrz, parseMrz } from "./mrz";
import { normalizeUpload, maxBytesFor } from "./images";
import { decodeProblems, encodeProblems, evaluatePreCheck, type PreCheckInput } from "./applications/precheck";
import { capRefund, DEFAULT_REFUND_POLICY, parseRefundPolicy, refundableForAddon, refundOnRejection } from "./payments/refund-policy";
import { addonOffer, DEFAULT_ADDON_RULES, parseAddonRules, providerOf } from "./partners/rules";

const FEES = { visa_thb: 2000, regular_service_thb: 600, express_service_thb: 2500 };

describe("pricing", () => {
  it("adds the visa fee and the package's service fee", () => {
    expect(applicationFees(FEES, "regular")).toEqual({ visa: 2000, service: 600, total: 2600 });
    expect(applicationFees(FEES, "express")).toEqual({ visa: 2000, service: 2500, total: 4500 });
  });
  it("tells which package is still possible", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(packageAvailability(now, new Date("2026-12-10T00:00:00Z"))).toMatchObject({ regular: true, express: true, reason: "ok" });
    expect(packageAvailability(now, new Date("2026-12-02T12:00:00Z"))).toMatchObject({ regular: false, express: true, reason: "express_only" });
    expect(packageAvailability(now, new Date("2026-12-01T10:00:00Z"))).toMatchObject({ regular: false, express: false, reason: "too_late" });
    expect(packageAvailability(now, new Date("2026-11-30T10:00:00Z"))).toMatchObject({ express: false, reason: "in_past" });
    expect(packageAvailability(now, new Date("2026-12-04T00:00:00Z")).regular).toBe(true);        // exactly 72 h
  });
  it("reads Thailand time and treats a missing time as the end of the day", () => {
    expect(arrivalInstant("2026-12-14", "05:40").toISOString()).toBe("2026-12-13T22:40:00.000Z");
    expect(arrivalInstant("2026-12-14").toISOString()).toBe("2026-12-14T16:59:00.000Z");
  });
  it("builds line items and a total without rounding drift", () => {
    const items = buildLineItems([{ id: "a1", package: "regular", travelerName: "Anika", visaFeeThb: 2000, serviceFeeThb: 600 }], [{ id: "o1", applicationId: "a1", name: "eSIM", priceThb: 399.1 }]);
    expect(items.map((i) => i.kind)).toEqual(["visa_fee", "service_fee", "addon"]);
    expect(totalThb(items)).toBe(2999.1); expect(toSatang(2999.1)).toBe(299910);
    expect(() => totalThb([{ kind: "addon", applicationId: "x", label: "bad", amountThb: -1 }])).toThrow();
    expect(() => totalThb([{ kind: "addon", applicationId: "x", label: "bad", amountThb: NaN }])).toThrow();
  });
  it("falls back to the defaults for damaged settings", () => {
    expect(parseFees({ visa_thb: "x", regular_service_thb: -5 }, FEES)).toEqual(FEES);
    expect(parseFees({ visa_thb: 1800 }, FEES).visa_thb).toBe(1800);
  });
});

describe("eligibility", () => {
  const cfg = parseEligibility({ voa: ["IND", "CHN", "bad", 5], visa_free: ["GBR"] });
  it("only keeps valid 3-letter codes", () => expect(cfg).toEqual({ voa: ["IND", "CHN"], visa_free: ["GBR"] }));
  it("answers from the admin lists and does not guess when they are empty", () => {
    expect(checkEligibility("ind", cfg)).toBe("voa"); expect(checkEligibility("GBR", cfg)).toBe("visa_free"); expect(checkEligibility("FRA", cfg)).toBe("other");
    expect(checkEligibility(null, cfg)).toBe("unknown"); expect(checkEligibility("IND", { voa: [], visa_free: [] })).toBe("unknown");
    expect(parseEligibility(null)).toEqual({ voa: [], visa_free: [] });
  });
});

describe("MRZ", () => {
  const L1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", L2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";   // ICAO 9303 specimen
  it("computes check digits", () => { expect(checkDigit("L898902C3")).toBe(6); expect(checkDigit("740812")).toBe(2); expect(checkDigit("120415")).toBe(9); });
  it("reads the ICAO specimen and verifies every check digit", () => {
    const r = parseMrz(`${L1}\n${L2}`, new Date("2026-11-07"))!;
    expect(r).toMatchObject({ surname: "ERIKSSON", givenNames: "ANNA MARIA", passportNumber: "L898902C3", nationality: "UTO", issuingState: "UTO", sex: "F", dateOfBirth: "1974-08-12", expiryDate: "2012-04-15", valid: true });
    expect(Object.values(r.checks).every(Boolean)).toBe(true);
  });
  it("copes with OCR noise: spaces, lower case, « characters and look-alike digits", () => {
    const noisy = `${L1.replace(/</g, "«")}\n${L2.toLowerCase().replace("7408122", "74O8122")}`;
    expect(parseMrz(noisy, new Date("2026-11-07"))?.valid).toBe(true);
    expect(normalizeMrz("garbage\n" + L1 + "\n" + L2)).toHaveLength(2);
  });
  it("flags a misread character instead of trusting it", () => {
    const bad = L2.replace("L898902C3", "L898902C8");
    const r = parseMrz(`${L1}\n${bad}`, new Date("2026-11-07"))!;
    expect(r.checks.passportNumber).toBe(false); expect(r.valid).toBe(false);
  });
  it("rejects things that are not a passport MRZ", () => { expect(parseMrz("hello")).toBeNull(); expect(parseMrz(`I<UTO${"X".repeat(40)}\n${L2}`)).toBeNull(); });
  it("puts a future two-digit birth year in the last century", () => expect(parseMrz(`${L1}\n${L2.replace("7408122F", "3008122F")}`, new Date("2026-11-07"))?.dateOfBirth).toBe("1930-08-12"));
});

describe("upload normalisation", () => {
  const noisy = (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  it("shrinks a big phone photo of a passport under 1 MB as JPEG", async () => {
    const r = await normalizeUpload(await noisy(3000, 2000), "passport_bio");
    expect(r.ok).toBe(true); if (r.ok) { expect(r.mime).toBe("image/jpeg"); expect(r.bytes.length).toBeLessThanOrEqual(maxBytesFor("passport_bio")); expect(r.bytes[0]).toBe(0xff); }
  });
  it("makes the face photo fit 100 KB", async () => {
    const r = await normalizeUpload(await noisy(2400, 2400), "photo");
    expect(r.ok).toBe(true); if (r.ok) expect(r.bytes.length).toBeLessThanOrEqual(100 * 1024);
  });
  it("removes metadata and respects rotation", async () => {
    const tagged = await sharp(await noisy(900, 600)).withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "secret-owner" } } }).jpeg().toBuffer();
    const r = await normalizeUpload(tagged, "funds");
    expect(r.ok).toBe(true);
    if (r.ok) { const m = await sharp(r.bytes).metadata(); expect(m.exif).toBeUndefined(); expect(m.width).toBeLessThan(m.height!); expect(r.bytes.includes(Buffer.from("secret-owner"))).toBe(false); }
  });
  it("passes small PDFs, refuses big ones and PDFs as the face photo", async () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1000)]);
    expect(await normalizeUpload(pdf, "return_ticket")).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(await normalizeUpload(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1.2 * 1024 * 1024)]), "return_ticket")).toEqual({ ok: false, error: "err_file_big" });
    expect(await normalizeUpload(pdf, "photo")).toEqual({ ok: false, error: "err_photo_must_be_image" });
  });
  it("refuses non-images, tiny images and empty files", async () => {
    expect(await normalizeUpload(Buffer.from("<html></html>"), "funds")).toEqual({ ok: false, error: "err_file_type" });
    expect(await normalizeUpload(await noisy(50, 50), "funds")).toEqual({ ok: false, error: "err_image_small" });
    expect(await normalizeUpload(new Uint8Array(), "funds")).toEqual({ ok: false, error: "err_file_missing" });
  });
});

describe("pre-check", () => {
  const base: PreCheckInput = { now: new Date("2026-11-07T00:00:00Z"), arrivalDate: "2026-12-14", departureDate: "2026-12-26", passportExpiry: "2031-03-08", dateOfBirth: "1990-05-01", documentKinds: ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"], requiredKinds: ["passport_bio", "photo", "return_ticket", "accommodation", "funds", "insurance"], insurancePending: false };
  it("passes a complete application", () => expect(evaluatePreCheck(base)).toEqual({ ok: true, waiting: false, problems: [] }));
  it("lists every problem as a code", () => {
    const r = evaluatePreCheck({ ...base, arrivalDate: "2026-11-01", passportExpiry: "2027-01-01", documentKinds: ["passport_bio"] });
    expect(r.ok).toBe(false); expect(r.problems.map((p) => p.code)).toEqual(expect.arrayContaining(["arrival_past", "passport_expiry", "missing_doc"]));
    expect(r.problems.filter((p) => p.code === "missing_doc").map((p) => p.kind)).toEqual(["photo", "return_ticket", "accommodation", "funds", "insurance"]);
  });
  it("needs 6 months of passport validity after arrival", () => {
    expect(evaluatePreCheck({ ...base, passportExpiry: "2027-06-11" }).problems).toEqual([{ code: "passport_expiry" }]);
    expect(evaluatePreCheck({ ...base, passportExpiry: "2027-06-12" }).ok).toBe(true);
  });
  it("checks the return flight and the 15-day stay", () => {
    expect(evaluatePreCheck({ ...base, departureDate: null }).problems[0].code).toBe("no_return_flight");
    expect(evaluatePreCheck({ ...base, departureDate: "2026-12-10" }).problems[0].code).toBe("return_before_arrival");
    expect(evaluatePreCheck({ ...base, departureDate: "2026-12-30" }).problems[0].code).toBe("stay_too_long");
    expect(evaluatePreCheck({ ...base, departureDate: "2026-12-29" }).ok).toBe(true);
  });
  it("waits (is not a problem) while the insurance document is being issued", () => {
    const r = evaluatePreCheck({ ...base, documentKinds: base.documentKinds.filter((k) => k !== "insurance"), insurancePending: true });
    expect(r).toEqual({ ok: false, waiting: true, problems: [] });
  });
  it("round-trips problems through the stored reason", () => {
    const ps = [{ code: "missing_doc" as const, kind: "photo" }, { code: "passport_expiry" as const }];
    expect(decodeProblems(encodeProblems(ps))).toEqual([{ code: "missing_doc", kind: "photo" }, { code: "passport_expiry", kind: undefined }]);
    expect(decodeProblems("Immigration: please re-upload")).toEqual([]);
  });
});

describe("refund policy", () => {
  it("does not refund visa or service fees, does refund unused add-ons", () => {
    const p = parseRefundPolicy({}); expect(p).toEqual(DEFAULT_REFUND_POLICY);
    const addons = [{ id: "a", priceThb: 399, refundedThb: 0, status: "issued" as const }, { id: "b", priceThb: 290, refundedThb: 0, status: "used" as const }, { id: "c", priceThb: 2000, refundedThb: 500, status: "paid" as const }];
    expect(refundableForAddon(addons[0], p)).toBe(399); expect(refundableForAddon(addons[1], p)).toBe(0); expect(refundableForAddon(addons[2], p)).toBe(1500);
    expect(refundOnRejection({ visaFeeThb: 2000, serviceFeeThb: 600, addons }, p)).toBe(1899);
    expect(refundOnRejection({ visaFeeThb: 2000, serviceFeeThb: 600, addons: [] }, p)).toBe(0);
  });
  it("follows the admin's switches", () => {
    const p = { visa_fee_refundable: true, service_fee_refundable: true, unused_addons_refundable: false };
    expect(refundOnRejection({ visaFeeThb: 2000, serviceFeeThb: 600, addons: [{ id: "a", priceThb: 399, refundedThb: 0, status: "issued" }] }, p)).toBe(2600);
  });
  it("never refunds more than was paid", () => { expect(capRefund(500, 1000, 700)).toBe(300); expect(capRefund(500, 1000, 1000)).toBe(0); expect(capRefund(100, 1000, 0)).toBe(100); });
  it("states that nothing is owed for cancelled / refunded add-ons", () => {
    for (const s of ["cancelled", "refunded", "pending_payment", "used"] as const) expect(refundableForAddon({ id: "x", priceThb: 100, refundedThb: 0, status: s }, DEFAULT_REFUND_POLICY)).toBe(0);
  });
});

describe("add-on rules", () => {
  const r = DEFAULT_ADDON_RULES;
  it("SIM and VIP: only at the listed airports and not with Express", () => {
    expect(addonOffer("sim", { arrivalAirportId: 1, package: "regular" }, r)).toEqual({ available: true });
    expect(addonOffer("sim", { arrivalAirportId: 1, package: "express" }, r)).toEqual({ available: false, reason: "express" });
    expect(addonOffer("vip", { arrivalAirportId: 3, package: "regular" }, r)).toEqual({ available: false, reason: "airport" });
    expect(addonOffer("vip", { arrivalAirportId: null, package: "regular" }, r)).toEqual({ available: false, reason: "airport" });
  });
  it("insurance, eSIM and health have no restriction", () => { for (const c of ["insurance", "esim", "health"] as const) expect(addonOffer(c, { arrivalAirportId: 3, package: "express" }, r)).toEqual({ available: true }); });
  it("admin can lift the Express block", () => expect(addonOffer("sim", { arrivalAirportId: 1, package: "express" }, parseAddonRules({ sim_blocked_for_express: false, sim_airports: [1, 2] }))).toEqual({ available: true }));
  it("maps categories to partners", () => { expect(providerOf("esim")).toBe("sim"); expect(providerOf("health")).toBe("bhs"); expect(providerOf("insurance")).toBe("insurance"); });
});
