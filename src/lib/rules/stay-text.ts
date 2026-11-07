// Words for "N days left" (pure; used by the Stay Guard page and its calculator).
type StayWords = { stay_left: string; stay_last_today: string; stay_past: string };
export type StayTone = "ok" | "soon" | "last" | "over";
export function stayLineFor(t: StayWords, left: number): { text: string; tone: StayTone } {
  if (left > 7) return { text: t.stay_left.replace("{n}", String(left)), tone: "ok" };
  if (left > 0) return { text: t.stay_left.replace("{n}", String(left)), tone: "soon" };
  if (left === 0) return { text: t.stay_last_today, tone: "last" };
  return { text: t.stay_past.replace("{n}", String(-left)), tone: "over" };
}
export const TONE: Record<StayTone, string> = { ok: "text-success", soon: "text-gold-deep", last: "text-danger", over: "text-danger" };
