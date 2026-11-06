import type { Dict } from "@/lib/i18n/dict";
import { decodeProblems } from "@/lib/applications/precheck";

const DOC_KEYS: Record<string, keyof Dict> = {
  passport_bio: "doc_passport_bio", photo: "doc_photo", return_ticket: "doc_return_ticket", accommodation: "doc_accommodation", funds: "doc_funds", insurance: "doc_insurance", other: "doc_other", additional: "doc_additional", evoa: "doc_evoa", signature: "doc_signature",
};
export const docLabel = (t: Dict, kind: string) => (DOC_KEYS[kind] ? t[DOC_KEYS[kind]] : kind);

const PROBLEM_KEYS: Record<string, keyof Dict> = {
  arrival_past: "reason_arrival_past", passport_expiry: "reason_passport_expiry", passport_missing: "reason_passport_missing", dob_missing: "reason_dob_missing",
  stay_too_long: "reason_stay_too_long", return_before_arrival: "reason_return_before_arrival", no_return_flight: "reason_no_return_flight",
};

/** Turns a stored reason into a sentence in the reader's language. Our own "precheck:…" codes are translated; Immigration's free text is shown as it is. */
export function reasonText(t: Dict, reason: string | null | undefined): string {
  if (!reason) return "";
  const problems = decodeProblems(reason);
  if (problems.length === 0) return reason.replace(/^Immigration:\s*/, "");
  return problems.map((p) => (p.code === "missing_doc" ? `${t.reason_missing_doc}: ${docLabel(t, String(p.kind))}` : t[PROBLEM_KEYS[p.code]] ?? p.code)).join("; ");
}
