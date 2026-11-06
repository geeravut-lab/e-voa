// Pure rules of the partner portal (no database): which categories a partner may list, voucher codes, the money split and the settlement CSV.
import { randomInt } from "node:crypto";
import type { AddonCategory } from "@/lib/partners/rules";

export type PartnerKind = "sim" | "vip" | "bhs" | "insurance";
export const PARTNER_KINDS: PartnerKind[] = ["sim", "vip", "bhs", "insurance"];
export const CATEGORIES_OF: Record<PartnerKind, AddonCategory[]> = { sim: ["sim", "esim"], vip: ["vip"], bhs: ["health"], insurance: ["insurance"] };
export const PRICE_MIN = 1, PRICE_MAX = 200_000;

export const isPartnerKind = (v: unknown): v is PartnerKind => typeof v === "string" && (PARTNER_KINDS as string[]).includes(v);
export const categoryAllowed = (kind: PartnerKind, category: string) => (CATEGORIES_OF[kind] as string[]).includes(category);

// No 0/O/1/I/L: the code is read out loud at a counter.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newVoucherCode = (): string => `TP-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
/** Staff type the code by hand: accept lower case, spaces and a missing dash. Returns null when it cannot be a code. */
export function normalizeVoucher(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s_-]/g, "");
  const m = /^(?:TP)?([A-Z0-9]{8})$/.exec(s);
  return m ? `TP-${m[1]}` : null;
}

/** The partner's share of one order, in satang-safe rounding: ThaiPass keeps the remainder. */
export const partnerShare = (priceThb: number, pct: number): number => Math.floor(priceThb * pct) / 100;

export const periodOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const isPeriod = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

export type SettlementLine = { usedAt: string; reference: string; code: string; item: string; priceThb: number; shareThb: number };
const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function settlementCsv(lines: SettlementLine[]): string {
  const head = ["used_at", "reference", "voucher_code", "item", "price_thb", "partner_share_thb"];
  const body = lines.map((l) => [l.usedAt, l.reference, l.code, l.item, l.priceThb.toFixed(2), l.shareThb.toFixed(2)].map(cell).join(","));
  const total = lines.reduce((a, l) => ({ p: a.p + l.priceThb, s: a.s + l.shareThb }), { p: 0, s: 0 });
  return [head.join(","), ...body, ["TOTAL", "", "", String(lines.length), total.p.toFixed(2), total.s.toFixed(2)].map(cell).join(",")].join("\n") + "\n";
}
