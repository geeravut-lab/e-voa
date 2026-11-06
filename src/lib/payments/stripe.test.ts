import { describe, expect, it } from "vitest";
import { StripeError, formEncode, signWebhook, verifyWebhook } from "./stripe";

describe("formEncode", () => {
  it("uses Stripe's bracket notation for nested objects and arrays and skips empty values", () => {
    const s = decodeURIComponent(formEncode({ mode: "payment", customer_email: undefined, metadata: { payment_id: "p1" }, line_items: [{ quantity: 1, price_data: { currency: "thb", unit_amount: 260000 } }] }));
    expect(s).toContain("mode=payment"); expect(s).toContain("metadata[payment_id]=p1");
    expect(s).toContain("line_items[0][price_data][unit_amount]=260000"); expect(s).toContain("line_items[0][quantity]=1");
    expect(s).not.toContain("customer_email");
  });
});

describe("webhook signature", () => {
  const secret = "whsec_test_secret"; const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
  it("accepts a correct signature", () => expect(verifyWebhook(body, signWebhook(body, secret), secret).id).toBe("evt_1"));
  it("rejects a changed body, a wrong secret, a missing header and a malformed header", () => {
    const h = signWebhook(body, secret);
    for (const [b, hd, sec] of [[body + " ", h, secret], [body, h, "other"], [body, null, secret], [body, "garbage", secret]] as const)
      expect(() => verifyWebhook(b, hd, sec)).toThrow(StripeError);
  });
  it("rejects old messages (replay) but accepts within five minutes", () => {
    const t = 1_700_000_000;
    expect(() => verifyWebhook(body, signWebhook(body, secret, t), secret, (t + 301) * 1000)).toThrow(/old/);
    expect(verifyWebhook(body, signWebhook(body, secret, t), secret, (t + 299) * 1000).type).toBe("checkout.session.completed");
  });
  it("accepts when one of several v1 signatures matches (secret rotation)", () => {
    const good = signWebhook(body, secret); const t = good.split(",")[0];
    expect(verifyWebhook(body, `${t},v1=${"0".repeat(64)},${good.split(",")[1]}`, secret).id).toBe("evt_1");
  });
});
