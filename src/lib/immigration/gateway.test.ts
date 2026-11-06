import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../../../tools/mock-partners/server.mjs";
import { HttpImmigrationGateway, ImmigrationError } from "./gateway";
import { Docket } from "./schema";
import { sampleDocket, sampleDoc } from "./testdata";

let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void> };
let gw: HttpImmigrationGateway;
let url = "";

beforeAll(async () => {
  mock = createMockServer({ decisionDelayMs: 10, log: () => {} });
  url = `http://127.0.0.1:${await mock.listen(0)}/immigration/th/v1`;
  gw = new HttpImmigrationGateway({ baseUrl: url, token: "jwt", from: "thaipass" });
});
afterAll(() => mock.close());

describe("schema", () => {
  it("accepts the sample docket and refuses broken ones", () => {
    expect(Docket.safeParse(sampleDocket("P1000001", "pay-a")).success).toBe(true);
    const few = sampleDocket("P1000001", "pay-b"); few.Applicants[0].documentList.pop();
    expect(Docket.safeParse(few).success).toBe(false);
    const wrongCount = { ...sampleDocket("P1000001", "pay-c"), NoOfApplicants: 2 };
    expect(Docket.safeParse(wrongCount).success).toBe(false);
    const badDate = sampleDocket("P1000001", "pay-d"); badDate.Applicants[0].passportDetails.DateOfBirth = "01/05/1990";
    expect(Docket.safeParse(badDate).success).toBe(false);
  });
});

describe("HttpImmigrationGateway against the simulator", () => {
  it("reads master data", async () => {
    const list = await gw.master("arrivalAirport");
    expect(list[0]).toMatchObject({ Id: 1, Name: "Suvarnabhumi International Airport" });
    expect((await gw.master("nationality"))[0]).toHaveProperty("CountryCode");
    expect((await gw.master("district", 1)).length).toBeGreaterThan(0);
  });
  it("submits a docket, then reads status and the E-VOA", async () => {
    const r = await gw.submitDocket(sampleDocket("P2000SLOW", "pay-gw1"));
    expect(r.successList).toHaveLength(1);
    const web = r.successList[0].webReferenceNumber;
    expect(await gw.status(web, "pay-gw1")).toBe("Pending");
    expect(await gw.evoa(web, "pay-gw1")).toBeNull();                       // not ready yet
    await fetch(url.replace("/immigration/th/v1", "/__admin/decide"), { method: "POST", body: JSON.stringify({ webReferenceNumber: web, statusId: 1 }) });
    expect(await gw.status(web, "pay-gw1")).toBe("Approved");
    expect((await gw.evoa(web, "pay-gw1"))?.toString()).toContain("%PDF");
    expect(await gw.status("NOPE", "x")).toBeNull();
  });
  it("returns the per-applicant refusal reason", async () => {
    const r = await gw.submitDocket(sampleDocket("P3000BAD", "pay-gw2"));
    expect(r.failedList[0].Reason).toContain("pre-validation");
  });
  it("accepts 1–5 additional documents and refuses 0 or 6 before calling", async () => {
    const a = { batchReference: "b", paymentReceiptNumber: "pay-gw1", webReferenceNumber: "W", documentList: [sampleDoc(4)] };
    await expect(gw.uploadAdditionalDocuments({ ...a, documentList: [] })).rejects.toMatchObject({ kind: "bad_request" });
    await expect(gw.uploadAdditionalDocuments({ ...a, documentList: [1, 2, 3, 4, 5, 6].map(() => sampleDoc(4)) })).rejects.toMatchObject({ kind: "bad_request" });
  });
});

describe("error classification", () => {
  it("wrong credentials are 'auth' and never retried", async () => {
    const strict = createMockServer({ immigrationToken: "right", log: () => {} });
    const port = await strict.listen(0);
    const g = new HttpImmigrationGateway({ baseUrl: `http://127.0.0.1:${port}/immigration/th/v1`, token: "wrong", from: "x" });
    await expect(g.master("gender")).rejects.toMatchObject({ kind: "auth", retryable: false });
    await strict.close();
  });
  it("an outage is 'unavailable' and retryable", async () => {
    await expect(gw.submitDocket(sampleDocket("P4000DOWN", "pay-gw3"))).rejects.toMatchObject({ kind: "unavailable", retryable: true, httpStatus: 503 });
  });
  it("an unreachable host is 'unavailable'", async () => {
    const g = new HttpImmigrationGateway({ baseUrl: "http://127.0.0.1:1/immigration/th/v1", token: "t", from: "f", timeoutMs: 500 });
    const e = await g.status("a", "b").catch((x) => x);
    expect(e).toBeInstanceOf(ImmigrationError); expect(e.kind).toBe("unavailable");
  });
  it("GETs are retried on 5xx but the docket is not", async () => {
    let calls = 0;
    const flaky = new HttpImmigrationGateway({
      baseUrl: "http://x.invalid/immigration/th/v1", token: "t", from: "f",
      fetchImpl: (async () => { calls++; return new Response("{}", { status: 503 }); }) as typeof fetch,
    });
    await expect(flaky.master("gender")).rejects.toMatchObject({ kind: "unavailable" });
    expect(calls).toBe(3);                                                   // 1 try + 2 retries
    calls = 0;
    await expect(flaky.submitDocket(sampleDocket("P1", "p"))).rejects.toMatchObject({ kind: "unavailable" });
    expect(calls).toBe(1);
  });
});
