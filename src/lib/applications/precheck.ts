// Checks done after payment and before sending to Immigration. Pure: the caller loads the data. A problem is a CODE (translated on screen), not a sentence.
import type { DocKind } from "@/lib/documents";

export const MIN_PASSPORT_VALID_DAYS = 180;   // passport must stay valid 6 months after arrival
export const MAX_STAY_DAYS = 15;              // Visa on Arrival stay

export type PreCheckInput = {
  now: Date;
  arrivalDate: string;                         // yyyy-mm-dd
  departureDate: string | null;
  passportExpiry: string | null;
  dateOfBirth: string | null;
  documentKinds: string[];                     // kinds that are stored and not deleted
  requiredKinds: string[];
  /** The insurance document will arrive from an add-on that is still being issued. */
  insurancePending: boolean;
};
export type Problem = { code: "arrival_past" | "passport_expiry" | "passport_missing" | "dob_missing" | "stay_too_long" | "return_before_arrival" | "no_return_flight" | "missing_doc"; kind?: DocKind | string };
export type PreCheckResult = { ok: boolean; waiting: boolean; problems: Problem[] };

const day = (s: string) => Date.parse(`${s}T00:00:00Z`);

export function evaluatePreCheck(i: PreCheckInput): PreCheckResult {
  const problems: Problem[] = [];
  const today = Date.UTC(i.now.getUTCFullYear(), i.now.getUTCMonth(), i.now.getUTCDate());
  if (day(i.arrivalDate) < today) problems.push({ code: "arrival_past" });
  if (!i.passportExpiry) problems.push({ code: "passport_missing" });
  else if (day(i.passportExpiry) < day(i.arrivalDate) + MIN_PASSPORT_VALID_DAYS * 86_400_000) problems.push({ code: "passport_expiry" });
  if (!i.dateOfBirth) problems.push({ code: "dob_missing" });
  if (!i.departureDate) problems.push({ code: "no_return_flight" });
  else if (day(i.departureDate) < day(i.arrivalDate)) problems.push({ code: "return_before_arrival" });
  else if ((day(i.departureDate) - day(i.arrivalDate)) / 86_400_000 > MAX_STAY_DAYS) problems.push({ code: "stay_too_long" });
  let waiting = false;
  for (const k of i.requiredKinds) {
    if (i.documentKinds.includes(k)) continue;
    if (k === "insurance" && i.insurancePending) { waiting = true; continue; }       // not a problem: it is on its way
    problems.push({ code: "missing_doc", kind: k });
  }
  return { ok: problems.length === 0 && !waiting, waiting: problems.length === 0 && waiting, problems };
}

/** One line stored in applications.status_reason, e.g. "precheck:missing_doc:photo,passport_expiry". */
export const encodeProblems = (ps: Problem[]) => "precheck:" + ps.map((p) => (p.kind ? `${p.code}:${p.kind}` : p.code)).join(",");
export const decodeProblems = (reason: string | null | undefined): Problem[] =>
  reason?.startsWith("precheck:") ? reason.slice(9).split(",").filter(Boolean).map((x) => { const [code, kind] = x.split(":"); return { code, kind } as Problem; }) : [];
