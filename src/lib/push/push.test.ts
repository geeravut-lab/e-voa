import { describe, expect, it } from "vitest";
import { buildPayload, endpointAllowed, isGone, parseSubscription } from "@/lib/push/rules";

const P256 = "B" + "a".repeat(86), AUTH = "x".repeat(22);
describe("web push subscriptions", () => {
  it("accept the push services of the big browsers only (the server calls the address it is given)", () => {
    for (const e of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/QAb", "https://par01.notify.windows.com/w/?token=x"]) expect(endpointAllowed(e), e).toBe(true);
    for (const e of ["http://fcm.googleapis.com/x", "https://evil.example.com/x", "https://fcm.googleapis.com.evil.com/x", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://169.254.169.254/latest", "https://localhost/x", "javascript:alert(1)", "not a url", ""]) expect(endpointAllowed(e), e).toBe(false);
  });
  it("parse the browser's JSON and refuse anything malformed", () => {
    const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: P256, auth: AUTH } };
    expect(parseSubscription(ok)).toEqual({ endpoint: ok.endpoint, p256dh: P256, auth: AUTH });
    expect(parseSubscription({ ...ok, keys: { p256dh: "short", auth: AUTH } })).toBeNull(); expect(parseSubscription({ ...ok, keys: { p256dh: P256, auth: "bad auth!" } })).toBeNull();
    expect(parseSubscription({ ...ok, endpoint: "https://evil.example.com/" })).toBeNull(); expect(parseSubscription({ endpoint: ok.endpoint })).toBeNull(); expect(parseSubscription(null)).toBeNull(); expect(parseSubscription("x")).toBeNull();
    expect(parseSubscription({ ...ok, endpoint: `https://fcm.googleapis.com/${"a".repeat(700)}` })).toBeNull();
  });
});
describe("web push payload", () => {
  it("keeps the text short and the link on this site", () => {
    const p = buildPayload({ title: "T".repeat(200), body: "B".repeat(500), link: "/trips/123", kind: "app.status", dedupeKey: "k" });
    expect(p.title).toHaveLength(80); expect(p.body).toHaveLength(160); expect(p.url).toBe("/trips/123"); expect(p.tag).toBe("k");
    for (const bad of ["https://evil.example.com", "//evil.example.com", "javascript:alert(1)", "/\\evil", undefined]) expect(buildPayload({ title: "x", link: bad as string | undefined }).url, String(bad)).toBe("/notifications");
    expect(buildPayload({ title: "x" }).body).toBe("");
  });
  it("tells a dead subscription from a temporary failure", () => { expect(isGone(404)).toBe(true); expect(isGone(410)).toBe(true); expect(isGone(429)).toBe(false); expect(isGone(500)).toBe(false); expect(isGone(0)).toBe(false); });
});
