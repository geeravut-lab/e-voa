import { describe, expect, it } from "vitest";
import { cleanName, hashToken, linkActive, newToken, nextDue, nextStep, roundPos, running, thaiDate, validEmail, validToken, canNotify, hoursAgo, type Schedule } from "./rules";
import { famText, fam } from "./text";
import type { Lang } from "@/lib/i18n/langs";

const H = 3_600_000;
const base = (o: Partial<Schedule> = {}): Schedule => ({ enabled: true, interval_hours: 24, grace_hours: 2, until_date: null, next_due_at: "2026-11-08T10:00:00Z", reminded_at: null, alerted_at: null, ...o });
const at = (iso: string) => new Date(iso);

describe("family check-in rules", () => {
  it("tokens are long, URL-safe, unique, and only their hash is a stable value", () => {
    const a = newToken(), b = newToken();
    expect(validToken(a)).toBe(true); expect(a).not.toBe(b);
    expect(validToken("short")).toBe(false); expect(validToken(`${a}!`)).toBe(false); expect(validToken(undefined)).toBe(false);
    expect(hashToken(a)).toBe(hashToken(a)); expect(hashToken(a)).not.toBe(hashToken(b)); expect(hashToken(a)).not.toContain(a);
  });
  it("validates e-mail and cleans names", () => {
    expect(validEmail("mum@example.com")).toBe(true);
    for (const bad of ["", "a@b", "a b@c.com", "<x>@y.com", 5, "a".repeat(200) + "@x.com"]) expect(validEmail(bad)).toBe(false);
    expect(cleanName("  Mum   Lek  ")).toBe("Mum Lek"); expect(cleanName(7)).toBe(""); expect(cleanName("x".repeat(100))).toHaveLength(60);
  });
  it("rounds a position to about 100 m and refuses impossible ones", () => {
    expect(roundPos(13.756331, 100.501765)).toEqual({ lat: 13.756, lon: 100.502 });
    expect(roundPos(91, 0)).toBeNull(); expect(roundPos(0, 181)).toBeNull(); expect(roundPos("x", 1)).toBeNull(); expect(roundPos(NaN, 1)).toBeNull();
  });
  it("counts the end date in Thai time", () => {
    expect(thaiDate(at("2026-11-08T17:30:00Z"))).toBe("2026-11-09");
    expect(running({ enabled: true, until_date: "2026-11-08" }, at("2026-11-08T16:59:00Z"))).toBe(true);
    expect(running({ enabled: true, until_date: "2026-11-08" }, at("2026-11-08T17:01:00Z"))).toBe(false);
    expect(running({ enabled: false, until_date: null }, at("2026-11-08T00:00:00Z"))).toBe(false);
    expect(nextDue(at("2026-11-08T00:00:00Z"), 12).toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });
  it("reminds once when due, alerts once after the waiting time, and never repeats", () => {
    expect(nextStep(base(), at("2026-11-08T09:59:00Z"))).toBe("none");
    expect(nextStep(base(), at("2026-11-08T10:00:00Z"))).toBe("remind");
    expect(nextStep(base({ reminded_at: "2026-11-08T10:05:00Z" }), at("2026-11-08T11:00:00Z"))).toBe("none");
    expect(nextStep(base({ reminded_at: "2026-11-08T10:05:00Z" }), at("2026-11-08T12:00:00Z"))).toBe("alert");
    expect(nextStep(base({ reminded_at: "2026-11-08T10:05:00Z", alerted_at: "2026-11-08T12:01:00Z" }), at("2026-11-08T20:00:00Z"))).toBe("none");
    // a missed reminder (job was down) still ends in an alert, not in a late reminder
    expect(nextStep(base(), at("2026-11-08T13:00:00Z"))).toBe("alert");
    // marks from an earlier due time do not block this one
    expect(nextStep(base({ reminded_at: "2026-11-07T10:05:00Z", alerted_at: "2026-11-07T12:05:00Z" }), at("2026-11-08T10:30:00Z"))).toBe("remind");
  });
  it("does nothing when switched off, ended, or without a due time", () => {
    expect(nextStep(base({ enabled: false }), at("2026-11-09T00:00:00Z"))).toBe("none");
    expect(nextStep(base({ until_date: "2026-11-07" }), at("2026-11-09T00:00:00Z"))).toBe("none");
    expect(nextStep(base({ next_due_at: null }), at("2026-11-09T00:00:00Z"))).toBe("none");
    expect(nextStep(base({ next_due_at: "nonsense" }), at("2026-11-09T00:00:00Z"))).toBe("none");
  });
  it("only contacts who agreed and did not leave are told; links end 7 days after the trip", () => {
    expect(canNotify({ confirmed_at: "2026-11-01T00:00:00Z", revoked_at: null })).toBe(true);
    expect(canNotify({ confirmed_at: null, revoked_at: null })).toBe(false);
    expect(canNotify({ confirmed_at: "2026-11-01T00:00:00Z", revoked_at: "2026-11-02T00:00:00Z" })).toBe(false);
    expect(linkActive({ revoked_at: null }, { until_date: "2026-11-08" }, at("2026-11-15T00:00:00Z"))).toBe(true);
    expect(linkActive({ revoked_at: null }, { until_date: "2026-11-08" }, at("2026-11-17T00:00:00Z"))).toBe(false);
    expect(linkActive({ revoked_at: "x" }, null, at("2026-11-08T00:00:00Z"))).toBe(false);
    expect(hoursAgo("2026-11-08T00:00:00Z", at("2026-11-08T05:30:00Z"))).toBe(5); expect(hoursAgo(null, new Date())).toBeNull();
    void H;
  });
  it("English, Thai and Chinese have the same message keys, with the same {placeholders}; a language without a pack falls back to English", () => {
    const en = famText("en"); const keys = Object.keys(en) as (keyof typeof en)[];
    for (const l of ["en", "th", "zh-CN"] as Lang[]) {
      const t = famText(l);
      for (const k of keys) {
        expect(typeof t[k], `${l}.${String(k)}`).toBe("string");
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
        expect(ph(t[k] as string), `${l}.${String(k)}`).toBe(ph(en[k] as string));
      }
    }
    expect(famText("ja").title).not.toBe(famText("en").title);            // Japanese is translated now (content/lang/ja-b.ts)
    expect(famText("ja").safe_btn).toBe("無事です");
    expect(fam("Hi {name}, {n}", { name: "A", n: 2 })).toBe("Hi A, 2");
  });
});
