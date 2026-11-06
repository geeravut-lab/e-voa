import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/settings", () => ({ getSetting: async (_k: string, d: unknown) => d }));
import { verifyLineSignature } from "@/lib/messaging/line";
import { parseMessaging, DEFAULT_MESSAGING } from "@/lib/messaging/settings";

describe("LINE webhook signature", () => {
  const secret = "channel-secret", body = '{"events":[]}';
  const sig = createHmac("sha256", secret).update(body).digest("base64");
  it("accepts the right signature only", () => {
    expect(verifyLineSignature(body, sig, secret)).toBe(true);
    expect(verifyLineSignature(body + " ", sig, secret)).toBe(false);            // body changed
    expect(verifyLineSignature(body, sig, "other-secret")).toBe(false);
    expect(verifyLineSignature(body, null, secret)).toBe(false); expect(verifyLineSignature(body, sig, "")).toBe(false);
    expect(verifyLineSignature(body, "short", secret)).toBe(false);
  });
});
describe("messaging settings", () => {
  it("defaults and clamps", () => {
    expect(parseMessaging(null)).toEqual(DEFAULT_MESSAGING);
    expect(parseMessaging({ line_enabled: false, line_quota: -4, whatsapp_quota: "x" })).toMatchObject({ line_enabled: false, line_quota: DEFAULT_MESSAGING.line_quota, whatsapp_quota: DEFAULT_MESSAGING.whatsapp_quota });
    expect(parseMessaging({ whatsapp_quota: 250 }).whatsapp_quota).toBe(250);
  });
});
