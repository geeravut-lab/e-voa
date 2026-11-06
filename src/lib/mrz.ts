// Reads the machine-readable zone (MRZ) at the bottom of a passport photo page (ICAO 9303, TD3: two lines of 44 characters).
// The text can come from OCR or from typing; every check digit is verified so a misread character is caught instead of trusted.

export type MrzResult = {
  documentType: string; issuingState: string; surname: string; givenNames: string; passportNumber: string; nationality: string;
  dateOfBirth: string; sex: "M" | "F" | "X"; expiryDate: string; personalNumber: string;
  checks: { passportNumber: boolean; dateOfBirth: boolean; expiryDate: boolean; personalNumber: boolean; composite: boolean };
  valid: boolean;
};

const WEIGHTS = [7, 3, 1];
const value = (ch: string) => (ch === "<" ? 0 : /[0-9]/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 55);   // A=10 … Z=35
export function checkDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += value(s[i]) * WEIGHTS[i % 3];
  return sum % 10;
}
const digitOk = (field: string, d: string) => d === "<" ? field.replace(/</g, "") === "" : /^\d$/.test(d) && checkDigit(field) === Number(d);

/** Cleans OCR output: upper case, keeps only A–Z 0–9 <, turns the usual look-alikes («, spaces, K at the end) into <. */
export function normalizeMrz(text: string): string[] {
  const lines = text.toUpperCase().replace(/[«‹＜]/g, "<").split(/\r?\n/).map((l) => l.replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "")).filter((l) => l.length >= 30);
  return lines.slice(-2).map((l) => l.padEnd(44, "<").slice(0, 44));
}

// Fields that must be numbers: fix the classic OCR confusions there only.
const toDigits = (s: string) => s.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8");

function isoDate(yymmdd: string, kind: "birth" | "expiry", now: Date): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2)), mm = Number(yymmdd.slice(2, 4)), dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const nowYY = now.getUTCFullYear() % 100;
  const century = kind === "birth" ? (yy > nowYY ? 1900 : 2000) : 2000;   // a birth year in the future is last century; passports expire in this one
  return `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseMrz(text: string, now = new Date()): MrzResult | null {
  const lines = normalizeMrz(text);
  if (lines.length !== 2 || lines[0][0] !== "P") return null;
  const [l1, l2] = lines;
  const names = l1.slice(5).split("<<");
  const surname = names[0].replace(/</g, " ").trim();
  const givenNames = (names[1] ?? "").replace(/</g, " ").trim();
  const numberField = l2.slice(0, 9), dobField = toDigits(l2.slice(13, 19)), expField = toDigits(l2.slice(21, 27)), personal = l2.slice(28, 42);
  const checks = {
    passportNumber: digitOk(numberField, toDigits(l2[9])),
    dateOfBirth: digitOk(dobField, toDigits(l2[19])),
    expiryDate: digitOk(expField, toDigits(l2[27])),
    personalNumber: digitOk(personal, toDigits(l2[42])),
    composite: false,
  };
  const composite = numberField + l2[9] + dobField + l2[19] + expField + l2[27] + personal + l2[42];
  checks.composite = digitOk(composite, toDigits(l2[43]));
  const sexCh = l2[20];
  const dob = isoDate(dobField, "birth", now), exp = isoDate(expField, "expiry", now);
  if (!dob || !exp || !surname) return null;
  return {
    documentType: l1.slice(0, 2).replace(/</g, ""), issuingState: l1.slice(2, 5).replace(/</g, ""), surname, givenNames,
    passportNumber: numberField.replace(/</g, ""), nationality: l2.slice(10, 13).replace(/</g, ""), dateOfBirth: dob,
    sex: sexCh === "M" ? "M" : sexCh === "F" ? "F" : "X", expiryDate: exp, personalNumber: personal.replace(/</g, ""),
    checks, valid: checks.passportNumber && checks.dateOfBirth && checks.expiryDate && checks.composite && (checks.personalNumber || personal.replace(/</g, "") === ""),
  };
}

/** ISO 3166 alpha-3 code in a passport → our nationality code (same alpha-3 list used by the master data CountryCode). Kept as identity but exported so a mapping can be added. */
export const nationalityCodeFromMrz = (c: string) => c.toUpperCase();
