// Application status rules. The SAME table lives in SQL (application_transition_ok);
// scripts/e2e-supabase.mjs compares every pair against the database, so the two cannot drift apart unnoticed.

export const STATUSES = [
  "draft", "awaiting_payment", "expired", "paid", "pre_check", "action_required", "submitted", "submission_failed",
  "under_review", "approved", "rejected", "cancelled", "used", "no_show",
] as const;
export type AppStatus = (typeof STATUSES)[number];

export const TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  draft: ["awaiting_payment", "cancelled", "expired"],
  awaiting_payment: ["paid", "expired", "cancelled", "draft"],
  expired: [],
  paid: ["pre_check", "cancelled"],
  pre_check: ["submitted", "submission_failed", "action_required", "cancelled"],
  action_required: ["pre_check", "submitted", "under_review", "cancelled"],
  submitted: ["under_review", "submission_failed", "approved", "rejected", "action_required"],
  submission_failed: ["submitted", "pre_check", "cancelled"],
  under_review: ["approved", "rejected", "action_required"],
  approved: ["used", "no_show"],
  rejected: [],
  cancelled: [],
  used: [],
  no_show: [],
};

export const canTransition = (from: AppStatus, to: AppStatus) => TRANSITIONS[from].includes(to);
export const isTerminal = (s: AppStatus) => TRANSITIONS[s].length === 0;
export const isAppStatus = (v: unknown): v is AppStatus => typeof v === "string" && (STATUSES as readonly string[]).includes(v);

/** Immigration's statusId (ICD updateStatusById): 1 Approved, 2 Rejected, 3 NeedUpdate. */
export function statusFromImmigration(statusId: number): AppStatus | null {
  return statusId === 1 ? "approved" : statusId === 2 ? "rejected" : statusId === 3 ? "action_required" : null;
}

/** The text of getStatusById → our status (used by the polling fallback). */
export function statusFromImmigrationText(text: string): AppStatus | null {
  const t = text.trim().toLowerCase();
  if (t === "approved") return "approved";
  if (t === "rejected") return "rejected";
  if (t === "needupdate" || t === "need update") return "action_required";
  if (t === "pending" || t === "underreview" || t === "under review") return "under_review";
  return null;
}

/** Service level agreed with the traveler: regular 72 h, express 24 h, counted from payment. */
export const slaHours = (pkg: "regular" | "express") => (pkg === "express" ? 24 : 72);

/** Can the traveler still change documents / details? */
export const travelerCanEdit = (s: AppStatus) => s === "draft" || s === "action_required";
