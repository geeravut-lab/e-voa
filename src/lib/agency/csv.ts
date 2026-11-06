// Reads a CSV of travelers (the agency's customers). Pure: the columns, the checks and the messages are decided here and tested on their own.
export const CSV_COLUMNS = ["given_name", "middle_name", "surname", "sex", "date_of_birth", "nationality", "passport_no", "passport_issue_date", "passport_expiry_date", "passport_place_of_issue", "email", "phone"] as const;
export const CSV_MAX_ROWS = 200;
export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}\nAnna,Maria,Eriksson,F,1990-05-01,SWE,L898902C3,2021-03-09,2031-03-08,Stockholm,anna@example.com,912345678\n`;

/** RFC 4180 style: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) { if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field); if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export type CsvTraveler = { given_name: string; middle_name: string; surname: string; sex: "M" | "F"; date_of_birth: string; nationality: string; passport_no: string; passport_issue_date: string; passport_expiry_date: string; passport_place_of_issue: string; email: string; phone: string };
const iso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Header + rows → travelers that passed every check, and one message per row that did not (row numbers are the file's, header is row 1). */
export function validateRows(rows: string[][]): { ok: CsvTraveler[]; errors: { row: number; message: string }[]; fatal?: string } {
  if (rows.length === 0) return { ok: [], errors: [], fatal: "empty" };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => c !== "middle_name" && !header.includes(c));
  if (missing.length) return { ok: [], errors: [], fatal: `columns: ${missing.join(", ")}` };
  if (rows.length - 1 > CSV_MAX_ROWS) return { ok: [], errors: [], fatal: `rows: at most ${CSV_MAX_ROWS}` };
  const ok: CsvTraveler[] = [], errors: { row: number; message: string }[] = [], seen = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const n = i + 2, get = (c: string) => (r[header.indexOf(c)] ?? "").trim();
    const t = { given_name: get("given_name"), middle_name: get("middle_name"), surname: get("surname"), sex: get("sex").toUpperCase(), date_of_birth: get("date_of_birth"), nationality: get("nationality").toUpperCase(), passport_no: get("passport_no").toUpperCase().replace(/\s+/g, ""),
      passport_issue_date: get("passport_issue_date"), passport_expiry_date: get("passport_expiry_date"), passport_place_of_issue: get("passport_place_of_issue"), email: get("email"), phone: get("phone").replace(/[^\d+]/g, "") };
    const bad = (m: string) => errors.push({ row: n, message: m });
    if (!t.given_name || !t.surname) return bad("name");
    if (t.sex !== "M" && t.sex !== "F") return bad("sex (M or F)");
    if (!iso(t.date_of_birth) || !iso(t.passport_issue_date) || !iso(t.passport_expiry_date)) return bad("dates (YYYY-MM-DD)");
    if (t.passport_issue_date >= t.passport_expiry_date) return bad("passport dates");
    if (!/^[A-Z]{3}$/.test(t.nationality)) return bad("nationality (3 letters, e.g. SWE)");
    if (!/^[A-Z0-9]{5,15}$/.test(t.passport_no)) return bad("passport_no");
    if (!t.passport_place_of_issue) return bad("passport_place_of_issue");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.email)) return bad("email");
    if (t.phone.replace(/\D/g, "").length < 5) return bad("phone");
    if (seen.has(t.passport_no)) return bad("passport_no appears twice in the file");
    seen.add(t.passport_no); ok.push(t as CsvTraveler);
  });
  return { ok, errors };
}
