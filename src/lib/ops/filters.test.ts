import { describe, expect, it } from "vitest";
import { BULK_MAX, BULK_RETRY_MAX, DEFAULT_FILTER, filterQuery, parseBulk, parseFilter, sameFilter } from "@/lib/ops/filters";

const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222";
const form = (o: Record<string, string | string[]>) => ({ getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : o[k] === undefined ? [] : [o[k] as string]), get: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[])[0] : (o[k] ?? null)) });

describe("queue filters", () => {
  it("fall back to the default for anything unknown, so an old saved filter never breaks the page", () => {
    expect(parseFilter({ g: "nope", a: "<script>", p: "gold", late: "yes", q: "  ab  " })).toEqual({ ...DEFAULT_FILTER, q: "ab" });
    expect(parseFilter(null)).toEqual(DEFAULT_FILTER); expect(parseFilter({ g: "all", a: "me", p: "express", late: "1" })).toEqual({ g: "all", q: "", a: "me", p: "express", late: true });
    expect(parseFilter({ a: U1 }).a).toBe(U1); expect(parseFilter({ q: "x".repeat(99) }).q).toHaveLength(40);
  });
  it("round-trip through the address", () => {
    const f = { g: "attention", q: "VOA 1", a: U1, p: "regular", late: true };
    const back = parseFilter(Object.fromEntries(new URLSearchParams(filterQuery(f)))); expect(back).toEqual(f); expect(sameFilter(back, f)).toBe(true);
    expect(filterQuery(DEFAULT_FILTER)).toBe("g=active");
  });
});

describe("bulk input", () => {
  it("needs at least one application and a known operation", () => {
    expect(parseBulk(form({ op: "assign_me" }))).toEqual({ ok: false, error: "err_ops_none_selected" });
    expect(parseBulk(form({ ids: [U1], op: "delete_everything" }))).toEqual({ ok: false, error: "err_form_incomplete" });
    expect(parseBulk(form({ ids: ["not-a-uuid"], op: "assign_me" }))).toEqual({ ok: false, error: "err_form_incomplete" });
  });
  it("drops duplicates and caps the size", () => {
    const r = parseBulk(form({ ids: [U1, U1, U2], op: "unassign" })); expect(r.ok && r.v.ids).toEqual([U1, U2]);
    expect(parseBulk(form({ ids: Array.from({ length: BULK_MAX + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`), op: "unassign" }))).toEqual({ ok: false, error: "err_form_incomplete" });
  });
  it("assign needs a person; note needs text; retry is limited", () => {
    expect(parseBulk(form({ ids: [U1], op: "assign" }))).toEqual({ ok: false, error: "err_ops_pick_assignee" });
    expect(parseBulk(form({ ids: [U1], op: "assign", assignee: U2 }))).toEqual({ ok: true, v: { ids: [U1], op: "assign", assignee: U2, note: "" } });
    expect(parseBulk(form({ ids: [U1], op: "note", note: "   " }))).toEqual({ ok: false, error: "err_form_incomplete" });
    expect(parseBulk(form({ ids: [U1], op: "note", note: " call back " }))).toMatchObject({ ok: true, v: { note: "call back" } });
    expect(parseBulk(form({ ids: Array.from({ length: BULK_RETRY_MAX + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`), op: "retry" }))).toEqual({ ok: false, error: "err_ops_retry_limit" });
  });
});
