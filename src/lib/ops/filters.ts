// The ops queue filters and bulk-action input. PURE: the page, the saved filters, the server action and the tests share it.
export const GROUPS: Record<string, string[]> = {
  attention: ["action_required", "submission_failed"],
  active: ["paid", "pre_check", "submitted", "under_review"],
  unpaid: ["draft", "awaiting_payment"],
  decided: ["approved", "rejected", "used", "no_show", "cancelled", "expired"],
};
export const SLA_OPEN = ["paid", "pre_check", "submitted", "under_review", "action_required", "submission_failed"];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QueueFilter = { g: string; q: string; a: string; p: string; late: boolean };
export const DEFAULT_FILTER: QueueFilter = { g: "active", q: "", a: "any", p: "any", late: false };

/** Reads the filter from a query string / saved row. Anything unknown falls back to the default, so a stale saved filter can never break the page. */
export function parseFilter(raw: Record<string, unknown> | null | undefined): QueueFilter {
  const o = raw ?? {}, s = (v: unknown) => (typeof v === "string" ? v : "");
  const g = s(o.g), a = s(o.a), p = s(o.p);
  return {
    g: g === "all" || GROUPS[g] ? g : DEFAULT_FILTER.g,
    q: s(o.q).trim().slice(0, 40),
    a: a === "me" || a === "none" || UUID.test(a) ? a : "any",
    p: p === "regular" || p === "express" ? p : "any",
    late: s(o.late) === "1" || o.late === true,
  };
}
/** The query string of a filter (the group is always there so a saved link opens the same tab). */
export function filterQuery(f: QueueFilter): string {
  const u = new URLSearchParams();
  u.set("g", f.g);
  if (f.q) u.set("q", f.q); if (f.a !== "any") u.set("a", f.a); if (f.p !== "any") u.set("p", f.p); if (f.late) u.set("late", "1");
  return u.toString();
}
export const sameFilter = (a: QueueFilter, b: QueueFilter) => filterQuery(a) === filterQuery(b);

export const BULK_OPS = ["assign_me", "assign", "unassign", "note", "retry"] as const;
export type BulkOp = (typeof BULK_OPS)[number];
export const BULK_MAX = 100, BULK_RETRY_MAX = 15;
export type BulkInput = { ids: string[]; op: BulkOp; assignee: string | null; note: string };

/** Validates a bulk request. Returns an err_* code instead of throwing; duplicates are dropped. */
export function parseBulk(fd: { getAll(k: string): unknown[]; get(k: string): unknown }): { ok: true; v: BulkInput } | { ok: false; error: string } {
  const ids = [...new Set(fd.getAll("ids").map(String))];
  if (ids.length === 0) return { ok: false, error: "err_ops_none_selected" };
  if (ids.length > BULK_MAX || ids.some((i) => !UUID.test(i))) return { ok: false, error: "err_form_incomplete" };
  const op = String(fd.get("op") ?? "") as BulkOp;
  if (!BULK_OPS.includes(op)) return { ok: false, error: "err_form_incomplete" };
  const assignee = String(fd.get("assignee") ?? "");
  if (op === "assign" && !UUID.test(assignee)) return { ok: false, error: "err_ops_pick_assignee" };
  const note = String(fd.get("note") ?? "").trim();
  if (op === "note" && (note.length < 1 || note.length > 1000)) return { ok: false, error: "err_form_incomplete" };
  if (op === "retry" && ids.length > BULK_RETRY_MAX) return { ok: false, error: "err_ops_retry_limit" };
  return { ok: true, v: { ids, op, assignee: op === "assign" ? assignee : null, note: op === "note" ? note : "" } };
}
