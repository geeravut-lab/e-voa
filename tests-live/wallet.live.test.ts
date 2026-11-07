// Google Wallet link against the REAL Supabase project: only the owner of an approved application gets a link. Everything created is removed at the end.
import { afterAll, describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { DICTS } from "@/lib/i18n/dict";
import { googleWalletLink } from "@/lib/wallet/service";
import { admin, cleanupUsers, makeDraft, makeUser, sql } from "./helpers";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ctx = { t: DICTS.en, lang: "en", brandName: "ThaiPass e-VOA" };
afterAll(async () => { const problems = await cleanupUsers(); for (const k of ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", "GOOGLE_WALLET_PRIVATE_KEY"]) delete process.env[k]; if (problems.length) throw new Error(problems.join("; ")); }, 120_000);

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
