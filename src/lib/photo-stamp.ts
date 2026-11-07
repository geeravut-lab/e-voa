// The line of text burned into the rental photos. PURE: the browser component and the tests share it.
const p2 = (n: number) => String(n).padStart(2, "0");
/** "2026-11-08 14:05:09 (UTC+7)" in the phone's own time zone, with its offset so the time is unambiguous. */
export function stampTime(d: Date): string {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-", h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} (UTC${sign}${h}${m ? `:${p2(m)}` : ""})`;
}
export const stampPlace = (pos: { lat: number; lon: number } | null) => (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon) ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : "");
/** What is printed on one photo. The shop name and slot are cut short so the line always fits. */
export function stampLines(o: { when: Date; shop: string; slot: string; pos: { lat: number; lon: number } | null }): string[] {
  const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
  return [clip([o.shop, o.slot].filter(Boolean).join(" · "), 60), stampTime(o.when), stampPlace(o.pos)].filter(Boolean);
}
/** A file name that is safe on every phone: letters, digits and dashes only. */
export const stampFileName = (slot: string, when: Date, i: number) => `rental-${i + 1}-${slot.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo"}-${when.getFullYear()}${p2(when.getMonth() + 1)}${p2(when.getDate())}-${p2(when.getHours())}${p2(when.getMinutes())}.jpg`;
