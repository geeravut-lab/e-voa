// The monthly statement of an agency: its applications, the service fees (after the agency's own discount) and the commission due on them.
// The visa fee is never commissionable. Pure (no database).
export type StatementLine = { date: string; reference: string; traveler: string; package: string; serviceFeeThb: number; commissionThb: number };
export type Statement = { statementNo: string; period: string; agencyName: string; commissionPct: number; lines: StatementLine[]; applications: number; serviceFeesThb: number; commissionThb: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Commission of one line, in satang-safe rounding (down): the same rule as the totals on the agency page. */
export const commissionOf = (serviceFeeThb: number, pct: number) => Math.floor(serviceFeeThb * pct) / 100;
export const statementNo = (period: string, agencyId: string) => `AGS-${period.replace("-", "")}-${agencyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

export function buildStatement(agency: { id: string; name: string; commissionPct: number }, period: string, rows: { date: string; reference: string; traveler: string; package: string; serviceFeeThb: number }[]): Statement {
  const lines = rows.map((x) => ({ ...x, commissionThb: commissionOf(x.serviceFeeThb, agency.commissionPct) })).sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));
  const serviceFeesThb = r2(lines.reduce((s, l) => s + l.serviceFeeThb, 0));
  return { statementNo: statementNo(period, agency.id), period, agencyName: agency.name, commissionPct: agency.commissionPct, lines, applications: lines.length, serviceFeesThb, commissionThb: r2(lines.reduce((s, l) => s + l.commissionThb, 0)) };
}

const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function statementCsv(s: Statement): string {
  const rows = s.lines.map((l) => [l.date, l.reference, l.traveler, l.package, l.serviceFeeThb.toFixed(2), l.commissionThb.toFixed(2)].map(cell).join(","));
  return "﻿" + [["date", "reference", "traveler", "package", "service_fee_thb", `commission_thb_${s.commissionPct}pct`].join(","), ...rows, ["TOTAL", s.statementNo, "", String(s.applications), s.serviceFeesThb.toFixed(2), s.commissionThb.toFixed(2)].map(cell).join(",")].join("\n") + "\n";
}
