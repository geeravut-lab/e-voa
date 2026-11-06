import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { cleanDraft } from "@/lib/applications/drafts";

describe("draft cleaning", () => {
  it("keeps known simple fields only", () => {
    expect(cleanDraft({ given_name: "Anna", passport_no: "L898902C3", nationality_id: 7, evil: "x", travelerId: "abc", appId: "def" })).toEqual({ given_name: "Anna", passport_no: "L898902C3", nationality_id: 7 });
  });
  it("drops empty, overlong and non-simple values, and gives null when nothing is left", () => {
    expect(cleanDraft({ given_name: "  ", surname: "x".repeat(201), email: { a: 1 }, phone: NaN })).toBeNull();
    expect(cleanDraft(null)).toBeNull(); expect(cleanDraft("text")).toBeNull();
  });
});
