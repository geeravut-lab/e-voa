import { describe, expect, it } from "vitest";
import { liveConfigFor, liveTopicsFor, nextDelay, parseLiveKeys } from "./watch";

const me = { userId: "abc", isAdmin: false };
const admin = { userId: "abc", isAdmin: true };

describe("liveTopicsFor", () => {
  it("everyone listens to their own topic only", () => expect(liveTopicsFor("/", me)).toEqual(["u:abc"]));
  it("admins add the admin topic only on admin pages", () => {
    expect(liveTopicsFor("/admin/audit", admin)).toEqual(["u:abc", "admin"]);
    expect(liveTopicsFor("/", admin)).toEqual(["u:abc"]);
  });
  it("a non-admin never gets the admin topic", () => expect(liveTopicsFor("/admin", me)).toEqual(["u:abc"]));
});

describe("liveConfigFor", () => {
  it("does not auto-refresh forms and chat", () => {
    expect(liveConfigFor("/apply/step-2", me).refresh).toBe(false);
    expect(liveConfigFor("/help", me).refresh).toBe(false);
    expect(liveConfigFor("/notifications", me).refresh).toBe(true);
  });
  it("polls admin pages faster", () => {
    expect(liveConfigFor("/admin", admin).intervalMs).toBeLessThan(liveConfigFor("/", admin).intervalMs);
  });
});

describe("nextDelay", () => {
  it("slows down while quiet and caps at 60 s", () => {
    expect(nextDelay(12_000, 0, false)).toBe(12_000);
    expect(nextDelay(12_000, 6, false)).toBe(24_000);
    expect(nextDelay(12_000, 18, false)).toBe(48_000);
    expect(nextDelay(20_000, 18, false)).toBe(60_000);
  });
  it("hidden tabs ask every 30 s", () => expect(nextDelay(5_000, 0, true)).toBe(30_000));
});

describe("parseLiveKeys", () => {
  it("keeps known keys, drops the rest, removes duplicates", () => {
    expect(parseLiveKeys("notif,admin,notif,evil")).toEqual(["notif", "admin"]);
    expect(parseLiveKeys("")).toEqual([]);
    expect(parseLiveKeys(null)).toEqual([]);
  });
});
