// Time ranges for the revenue dashboard. Thailand has no daylight saving: local time is UTC+7 all year. Pure (no database).
export type RangeKey = "today" | "week" | "month" | "year" | "custom";
export const RANGE_KEYS: RangeKey[] = ["today", "week", "month", "year", "custom"];
export type Bucket = "hour" | "day" | "month";
export type Range = { key: RangeKey; from: Date; to: Date; fromDate: string; toDate: string; bucket: Bucket };

const H7 = 7 * 3_600_000, DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
/** The calendar date in Thailand of an instant, as yyyy-mm-dd. */
export const thaiDate = (d: Date) => { const t = new Date(d.getTime() + H7); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
/** The instant when a Thai calendar day starts. */
const startOf = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d) - H7); };
const validYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && thaiDate(startOf(s)) === s;
const bucketFor = (from: Date, to: Date): Bucket => { const days = (to.getTime() - from.getTime()) / DAY; return days <= 1 ? "hour" : days <= 62 ? "day" : "month"; };

/** Turns the chosen filter into [from, to) in real instants. A bad custom range falls back to "this month" so the page always works. */
export function resolveRange(key: string | undefined, now: Date, fromStr?: string, toStr?: string): Range {
  const today = thaiDate(now), [y, m, d] = today.split("-").map(Number);
  let k: RangeKey = RANGE_KEYS.includes(key as RangeKey) ? (key as RangeKey) : "month";
  let from: Date, to: Date;
  if (k === "custom") {
    if (validYmd(fromStr) && validYmd(toStr) && fromStr <= toStr && (startOf(toStr).getTime() - startOf(fromStr).getTime()) / DAY <= 3 * 366) { from = startOf(fromStr); to = new Date(startOf(toStr).getTime() + DAY); }
    else { k = "month"; from = to = now; }
  } else { from = to = now; }
  if (k === "today") { from = startOf(today); to = new Date(from.getTime() + DAY); }
  else if (k === "week") { const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; from = new Date(startOf(today).getTime() - dow * DAY); to = new Date(from.getTime() + 7 * DAY); }      // weeks start on Monday
  else if (k === "month") { from = new Date(Date.UTC(y, m - 1, 1) - H7); to = new Date(Date.UTC(y, m, 1) - H7); }
  else if (k === "year") { from = new Date(Date.UTC(y, 0, 1) - H7); to = new Date(Date.UTC(y + 1, 0, 1) - H7); }
  return { key: k, from, to, fromDate: thaiDate(from), toDate: thaiDate(new Date(to.getTime() - 1)), bucket: bucketFor(from, to) };
}

/** The label of the chart column an instant falls in: "07" (hour), "2026-11-06" (day) or "2026-11" (month), in Thai time. */
export function bucketKey(at: Date, bucket: Bucket): string {
  const t = new Date(at.getTime() + H7), ymd = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  return bucket === "hour" ? pad(t.getUTCHours()) : bucket === "day" ? ymd : ymd.slice(0, 7);
}
/** Every column of a range, in order (empty ones included, so a quiet day shows as an empty column). */
export function bucketKeys(r: Range): string[] {
  if (r.bucket === "hour") return Array.from({ length: 24 }, (_, i) => pad(i));
  const out: string[] = []; const seen = new Set<string>();
  for (let t = r.from.getTime(); t < r.to.getTime(); t += r.bucket === "day" ? DAY : DAY * 7) { const k = bucketKey(new Date(t), r.bucket); if (!seen.has(k)) { seen.add(k); out.push(k); } }
  const last = bucketKey(new Date(r.to.getTime() - 1), r.bucket); if (!seen.has(last)) out.push(last);
  return out;
}
