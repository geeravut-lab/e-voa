// Google Wallet link against the REAL Supabase project: only the owner of an approved application gets a link. Everything created is removed at the end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import http2 from "node:http2";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { appleChangedSerials, applePassForPhone, appleRegister, appleUnregister, appleWalletFile, googleWalletLink, syncWalletPasses } from "@/lib/wallet/service";
import { makeTestCerts, readZip } from "./wallet-certs";
import { admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ctx = { lang: "en" };
let mock: { listen: (p?: number) => Promise<number>; close: () => Promise<void>; state: { walletPatches: { id: string; state: string; text: string; header: string }[] } }; let mockBase = "";
beforeAll(async () => { mock = createMockServer({ log: () => {} }); mockBase = `http://127.0.0.1:${await mock.listen(0)}`; }, 60_000);
afterAll(async () => { const problems = await cleanupUsers(); for (const k of ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", "GOOGLE_WALLET_PRIVATE_KEY", "GOOGLE_WALLET_TOKEN_URL", "GOOGLE_WALLET_API_URL", "APPLE_WALLET_PASS_TYPE_ID", "APPLE_WALLET_TEAM_ID", "APPLE_WALLET_CERT", "APPLE_WALLET_KEY", "APPLE_WALLET_WWDR", "APPLE_APNS_URL", "APPLE_APNS_CA"]) delete process.env[k]; await mock?.close(); if (problems.length) throw new Error(problems.join("; ")); }, 120_000);

// the status guard only allows real transitions; the test needs a state without a whole journey, so it skips the guard for its own row
const setStatus = (id: string, status: string) => sql(`set session_replication_role = replica; update public.applications set status = '${status}' where id = '${id}'`);

describe("Google Wallet link", () => {
  it("gives the owner of an approved application a signed link, and nobody else", async () => {
    const a = await makeUser("wal-a"), b = await makeUser("wal-b"), d = await makeDraft(a, "APR");
    const off = await googleWalletLink(a.id, d.appId, ctx); expect(off).toEqual({ ok: false, error: "not_configured" });                // nothing set up: no link
    Object.assign(process.env, { GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "wallet@proj.iam.gserviceaccount.com", GOOGLE_WALLET_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n") });
    expect(await googleWalletLink(a.id, d.appId, ctx)).toEqual({ ok: false, error: "not_found" });                                      // still a draft
    await setStatus(d.appId, "approved");
    expect(await googleWalletLink(b.id, d.appId, ctx)).toEqual({ ok: false, error: "not_found" });                                      // someone else's application
    const r = await googleWalletLink(a.id, d.appId, ctx); expect(r.ok).toBe(true); if (!r.ok) return;
    const jwt = r.url.replace("https://pay.google.com/gp/v/save/", ""), [h, body, sig] = jwt.split(".");
    expect(createVerify("RSA-SHA256").update(`${h}.${body}`).verify(publicKey, sig, "base64url")).toBe(true);
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()), obj = claims.payload.genericObjects[0];
    const ref = (await admin.from("applications").select("ref_no").eq("id", d.appId).single()).data!.ref_no as string;
    expect(obj.id).toBe(`3388000000012345678.${ref}`); expect(obj.barcode.value).toMatch(/\/v\/[0-9a-f-]{36}\.[\w-]+$/);                // the same QR as the on-screen pass
    expect(JSON.stringify(obj)).toContain("Test Traveler"); expect(JSON.stringify(obj)).toMatch(/••••\d{1,4}/);
    await setStatus(d.appId, "rejected");
    expect(await googleWalletLink(a.id, d.appId, ctx)).toEqual({ ok: false, error: "not_found" });                                      // a rejected application gets no pass
  });
});

describe("wallet pass updates", () => {
  it("Google: a handed-out pass is updated when the application changes, and only then", async () => {
    Object.assign(process.env, { GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "wallet@proj.iam.gserviceaccount.com", GOOGLE_WALLET_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n"), GOOGLE_WALLET_TOKEN_URL: `${mockBase}/wallet/token`, GOOGLE_WALLET_API_URL: `${mockBase}/wallet` });
    const a = await makeUser("wal-up"), d = await makeDraft(a, "APR"); await setStatus(d.appId, "approved");
    expect((await googleWalletLink(a.id, d.appId, ctx)).ok).toBe(true);
    const row = () => sql<{ fingerprint: string; platform: string; last_error: string | null }>(`select fingerprint, platform, last_error from public.wallet_passes where application_id = '${d.appId}'`);
    expect((await row())).toHaveLength(1);
    mock.state.walletPatches.length = 0;
    expect(await syncWalletPasses({ applicationId: d.appId })).toEqual({ checked: 1, updated: 0, failed: 0 }); expect(mock.state.walletPatches).toHaveLength(0);         // nothing changed: nothing sent
    await setStatus(d.appId, "no_show");
    expect(await syncWalletPasses({ applicationId: d.appId })).toEqual({ checked: 1, updated: 1, failed: 0 });
    expect(mock.state.walletPatches).toHaveLength(1); expect(mock.state.walletPatches[0]).toMatchObject({ state: "INACTIVE" }); expect(mock.state.walletPatches[0].id).toMatch(/^3388000000012345678\.EV-/);
    expect(mock.state.walletPatches[0].text).toContain("status");
    expect(await syncWalletPasses({ applicationId: d.appId })).toEqual({ checked: 1, updated: 0, failed: 0 });                                                      // sent once, not again
    process.env.GOOGLE_WALLET_API_URL = "http://127.0.0.1:1";                                                                                                       // Google unreachable: counted as failed, retried next time
    await setStatus(d.appId, "approved");
    expect(await syncWalletPasses({ applicationId: d.appId })).toEqual({ checked: 1, updated: 0, failed: 1 }); expect((await row())[0].last_error).toBeTruthy();
    process.env.GOOGLE_WALLET_API_URL = `${mockBase}/wallet`;
    expect(await syncWalletPasses({ applicationId: d.appId })).toEqual({ checked: 1, updated: 1, failed: 0 }); expect(mock.state.walletPatches.at(-1)).toMatchObject({ state: "ACTIVE" });
  });

  it("Apple: the file, the phone's web service (register, changes, newest file, stop) and the push when the application changes", async () => {
    const certs = makeTestCerts(), pushes: string[] = [];
    const apns = http2.createSecureServer({ cert: certs.serverCert, key: certs.serverKey, requestCert: true, rejectUnauthorized: false });
    apns.on("stream", (stream, h) => { pushes.push(`${h[":path"]}|${h["apns-topic"]}`); stream.on("data", () => {}); stream.on("end", () => { stream.respond({ ":status": "200" }); stream.end(); }); });
    await new Promise<void>((r) => apns.listen(0, "127.0.0.1", r));
    Object.assign(process.env, { APPLE_WALLET_PASS_TYPE_ID: "pass.test.evoa", APPLE_WALLET_TEAM_ID: "ABCDE12345", APPLE_WALLET_CERT: certs.signerCert, APPLE_WALLET_KEY: certs.signerKey, APPLE_WALLET_WWDR: certs.wwdr,
      APPLE_APNS_URL: `https://127.0.0.1:${(apns.address() as { port: number }).port}`, APPLE_APNS_CA: certs.serverCert });
    try {
      const a = await makeUser("wal-ap"), b = await makeUser("wal-ap2"), d = await makeDraft(a, "APR");
      expect(await appleWalletFile(a.id, d.appId, ctx)).toEqual({ ok: false, error: "not_found" });                                  // still a draft
      await setStatus(d.appId, "approved");
      expect(await appleWalletFile(b.id, d.appId, ctx)).toEqual({ ok: false, error: "not_found" });                                  // someone else's
      const f = await appleWalletFile(a.id, d.appId, ctx); expect(f.ok).toBe(true); if (!f.ok) return;
      const pass = JSON.parse(readZip(f.file).get("pass.json")!.toString()), serial = pass.serialNumber as string, token = pass.authenticationToken as string, T = "pass.test.evoa", auth = `ApplePass ${token}`;
      expect(serial).toMatch(/^evoa-EV-/); expect(pass.webServiceURL).toMatch(/\/api\/wallet\/apple$/);
      const again = await appleWalletFile(a.id, d.appId, ctx); expect(again.ok && JSON.parse(readZip(again.file).get("pass.json")!.toString()).authenticationToken).toBe(token);          // the same pass keeps its token
      expect(await appleRegister("dev1", T, serial, "ApplePass wrong", "aabbccddeeff00112233")).toBe(401);
      expect(await appleRegister("dev1", "pass.other", serial, auth, "aabbccddeeff00112233")).toBe(404);
      expect(await appleRegister("dev1", T, serial, auth, "not hex!")).toBe(400);
      expect(await appleRegister("dev1", T, serial, auth, "aabbccddeeff00112233")).toBe(201); expect(await appleRegister("dev1", T, serial, auth, "aabbccddeeff00112233")).toBe(200);
      const first = await appleChangedSerials("dev1", T, null); expect(first?.serialNumbers).toEqual([serial]);
      expect(await appleChangedSerials("dev1", T, first!.lastUpdated)).toBeNull();                                                  // nothing newer than the tag the phone has
      expect(await appleChangedSerials("dev2", T, null)).toBeNull();                                                                // another phone has nothing registered
      expect(await applePassForPhone(T, serial, "ApplePass wrong", null)).toEqual({ status: 401 });
      const got = await applePassForPhone(T, serial, auth, null); expect(got.status).toBe(200);
      expect(await applePassForPhone(T, serial, auth, got.status === 200 ? got.lastModified : null)).toEqual({ status: 304 });       // not modified since
      expect(await syncWalletPasses({ applicationId: d.appId })).toMatchObject({ updated: 0, failed: 0 }); expect(pushes).toHaveLength(0);
      await setStatus(d.appId, "no_show");                                                                                          // the application changes → the phone is told
      expect(await syncWalletPasses({ applicationId: d.appId })).toMatchObject({ updated: 1, failed: 0 });
      expect(pushes).toEqual([`/3/device/aabbccddeeff00112233|${T}`]);
      const changed = await appleChangedSerials("dev1", T, first!.lastUpdated); expect(changed?.serialNumbers).toEqual([serial]);
      const newest = await applePassForPhone(T, serial, auth, null); expect(newest.status).toBe(200);
      if (newest.status === 200) { const j = JSON.parse(readZip(newest.file).get("pass.json")!.toString()); expect(j.voided).toBe(true); expect(JSON.stringify(j.generic)).toContain("Not used"); }
      expect(await appleUnregister("dev1", T, serial, "ApplePass wrong")).toBe(401); expect(await appleUnregister("dev1", T, serial, auth)).toBe(200);
      expect(await appleChangedSerials("dev1", T, null)).toBeNull();
    } finally { await new Promise((r) => apns.close(r)); }
  });
});
