// Places travelers ask about. PURE. The weather and air data are asked for these coordinates, never for a position typed or sent by a user.
export type Place = { slug: string; name: { en: string; th: string; "zh-CN": string }; lat: number; lon: number; aliases: string[] };
export const PLACES: Place[] = [
  { slug: "bangkok", name: { en: "Bangkok", th: "กรุงเทพมหานคร", "zh-CN": "曼谷" }, lat: 13.7563, lon: 100.5018, aliases: ["krung thep", "bkk", "sukhumvit", "silom", "khao san"] },
  { slug: "pattaya", name: { en: "Pattaya (Chonburi)", th: "พัทยา (ชลบุรี)", "zh-CN": "芭堤雅" }, lat: 12.9276, lon: 100.8771, aliases: ["chonburi", "chon buri", "jomtien"] },
  { slug: "phuket", name: { en: "Phuket", th: "ภูเก็ต", "zh-CN": "普吉岛" }, lat: 7.8804, lon: 98.3923, aliases: ["patong", "karon", "kata"] },
  { slug: "krabi", name: { en: "Krabi", th: "กระบี่", "zh-CN": "甲米" }, lat: 8.0863, lon: 98.9063, aliases: ["ao nang", "railay", "koh lanta", "ko lanta"] },
  { slug: "phang-nga", name: { en: "Phang Nga (Khao Lak)", th: "พังงา (เขาหลัก)", "zh-CN": "攀牙" }, lat: 8.4501, lon: 98.5255, aliases: ["phangnga", "khao lak", "similan"] },
  { slug: "koh-samui", name: { en: "Koh Samui (Surat Thani)", th: "เกาะสมุย (สุราษฎร์ธานี)", "zh-CN": "苏梅岛" }, lat: 9.512, lon: 100.0136, aliases: ["samui", "surat thani", "koh phangan", "koh tao", "ko samui"] },
  { slug: "chiang-mai", name: { en: "Chiang Mai", th: "เชียงใหม่", "zh-CN": "清迈" }, lat: 18.7883, lon: 98.9853, aliases: ["chiangmai", "pai"] },
  { slug: "chiang-rai", name: { en: "Chiang Rai", th: "เชียงราย", "zh-CN": "清莱" }, lat: 19.9072, lon: 99.8326, aliases: ["chiangrai"] },
  { slug: "mae-hong-son", name: { en: "Mae Hong Son", th: "แม่ฮ่องสอน", "zh-CN": "夜丰颂" }, lat: 19.3013, lon: 97.9654, aliases: ["pai mae hong son"] },
  { slug: "hua-hin", name: { en: "Hua Hin (Prachuap Khiri Khan)", th: "หัวหิน (ประจวบคีรีขันธ์)", "zh-CN": "华欣" }, lat: 12.5684, lon: 99.9577, aliases: ["prachuap", "prachuap khiri khan"] },
  { slug: "ayutthaya", name: { en: "Ayutthaya", th: "พระนครศรีอยุธยา", "zh-CN": "大城" }, lat: 14.3532, lon: 100.5689, aliases: ["ayuthaya"] },
  { slug: "kanchanaburi", name: { en: "Kanchanaburi", th: "กาญจนบุรี", "zh-CN": "北碧" }, lat: 14.0228, lon: 99.5328, aliases: ["kanchanaburi river kwai", "erawan"] },
  { slug: "khon-kaen", name: { en: "Khon Kaen", th: "ขอนแก่น", "zh-CN": "孔敬" }, lat: 16.4419, lon: 102.836, aliases: [] },
  { slug: "udon-thani", name: { en: "Udon Thani", th: "อุดรธานี", "zh-CN": "乌隆他尼" }, lat: 17.4138, lon: 102.7872, aliases: ["udon"] },
  { slug: "nakhon-ratchasima", name: { en: "Nakhon Ratchasima (Khao Yai)", th: "นครราชสีมา (เขาใหญ่)", "zh-CN": "呵叻" }, lat: 14.9799, lon: 102.0978, aliases: ["korat", "khao yai"] },
  { slug: "ubon-ratchathani", name: { en: "Ubon Ratchathani", th: "อุบลราชธานี", "zh-CN": "乌汶" }, lat: 15.2287, lon: 104.8564, aliases: ["ubon"] },
  { slug: "sukhothai", name: { en: "Sukhothai", th: "สุโขทัย", "zh-CN": "素可泰" }, lat: 17.0078, lon: 99.8264, aliases: [] },
  { slug: "trat", name: { en: "Trat (Koh Chang)", th: "ตราด (เกาะช้าง)", "zh-CN": "桐艾" }, lat: 12.2428, lon: 102.5175, aliases: ["koh chang", "ko chang", "koh kood"] },
  { slug: "rayong", name: { en: "Rayong (Koh Samet)", th: "ระยอง (เกาะเสม็ด)", "zh-CN": "罗勇" }, lat: 12.6814, lon: 101.2816, aliases: ["koh samet", "ko samet"] },
  { slug: "hat-yai", name: { en: "Hat Yai (Songkhla)", th: "หาดใหญ่ (สงขลา)", "zh-CN": "合艾" }, lat: 7.0084, lon: 100.4747, aliases: ["songkhla", "hatyai"] },
  { slug: "trang", name: { en: "Trang", th: "ตรัง", "zh-CN": "董里" }, lat: 7.5563, lon: 99.6114, aliases: ["koh libong", "koh mook"] },
  { slug: "satun", name: { en: "Satun (Koh Lipe)", th: "สตูล (เกาะหลีเป๊ะ)", "zh-CN": "沙敦" }, lat: 6.6238, lon: 100.0674, aliases: ["koh lipe", "ko lipe"] },
  { slug: "nakhon-si-thammarat", name: { en: "Nakhon Si Thammarat", th: "นครศรีธรรมราช", "zh-CN": "洛坤" }, lat: 8.4304, lon: 99.9631, aliases: ["khanom"] },
  { slug: "nan", name: { en: "Nan", th: "น่าน", "zh-CN": "南邦" }, lat: 18.7756, lon: 100.7730, aliases: [] },
  { slug: "loei", name: { en: "Loei (Chiang Khan)", th: "เลย (เชียงคาน)", "zh-CN": "黎府" }, lat: 17.4860, lon: 101.7223, aliases: ["chiang khan", "phu kradueng"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9฀-๿一-鿿 ]+/g, " ").replace(/\s+/g, " ").trim();
/** A place by slug, name, alias or a word inside what was typed ("Is it safe in Patong?"). Null when nothing matches: the caller says which places it knows. */
export function findPlace(query: unknown): Place | null {
  const q = norm(typeof query === "string" ? query.slice(0, 120) : ""); if (q.length < 2) return null;
  const keys = (p: Place) => [p.slug.replace(/-/g, " "), p.name.en, p.name.th, p.name["zh-CN"], ...p.aliases].map(norm).filter(Boolean);
  const exact = PLACES.find((p) => keys(p).includes(q)); if (exact) return exact;
  const padded = ` ${q} `, hits = PLACES.filter((p) => keys(p).some((k) => k.length >= 3 && (padded.includes(` ${k} `) || (k.length >= 4 && q.includes(k)))));
  return hits.length === 1 ? hits[0] : hits.sort((a, b) => Math.max(...keys(b).map((k) => (q.includes(k) ? k.length : 0))) - Math.max(...keys(a).map((k) => (q.includes(k) ? k.length : 0))))[0] ?? null;
}
const rad = (d: number) => (d * Math.PI) / 180;
export const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
/** The closest place on the list, if one is within `maxKm` (a phone far away from every place gets nothing rather than a wrong city). */
export function nearestPlace(lat: number, lon: number, maxKm = 150): Place | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let best: Place | null = null, d = Infinity;
  for (const p of PLACES) { const x = distanceKm({ lat, lon }, p); if (x < d) { d = x; best = p; } }
  return best && d <= maxKm ? best : null;
}
