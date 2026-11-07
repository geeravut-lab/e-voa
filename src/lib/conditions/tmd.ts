// Thai Meteorological Department warnings (CAP alerts, the public RSS at https://www.tmd.go.th/api/xml/CAP). PURE parsing and matching.
// Verified against the real feed on 8 Nov 2026: an RSS with up to 5 <item> (title, description, link to a CAP document, pubDate); each CAP document (urn:oasis:names:tc:emergency:cap:1.2)
// has status, msgType, event, urgency, severity, effective, expires, headline, description, instruction and area/areaDesc (Thai province names separated by spaces).
import type { Place } from "./places";

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (entities[e.toLowerCase()] ?? m)));
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml); return m ? decode(m[1]).replace(/\s+/g, " ").trim() : ""; };

export type FeedItem = { title: string; link: string; pubDate: string };
/**
 * The items of the RSS. The server fetches every link, so only two kinds are kept: the department's own documents (https://www.tmd.go.th/uploads/CAP/….xml), and, when the operator
 * pointed the service at another feed (a test server), documents on that same origin (`sameOrigin`, e.g. "http://127.0.0.1:4010").
 */
export function parseCapFeed(xml: string, sameOrigin = ""): FeedItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => ({ title: tag(m[1], "title"), link: tag(m[1], "link"), pubDate: tag(m[1], "pubDate") }));
  const own = /^https:\/\/www\.tmd\.go\.th\/uploads\/CAP\/[\w.-]+\.xml$/;
  const other = sameOrigin ? new RegExp(`^${sameOrigin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/[\\w./-]+\\.xml$`) : null;
  return items.filter((i) => own.test(i.link) || (other !== null && other.test(i.link) && !i.link.includes(".."))).slice(0, 8);
}

export type Warning = { id: string; event: string; headline: string; description: string; instruction: string; severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"; effective: string | null; expires: string | null; areas: string[]; link: string };
const SEV = ["Extreme", "Severe", "Moderate", "Minor"] as const;
/** One CAP document. Returns null when it is not a real, public, current alert ("Actual", not "Cancel"). */
export function parseCapAlert(xml: string, link = ""): Warning | null {
  const status = tag(xml, "status"), msgType = tag(xml, "msgType"), scope = tag(xml, "scope");
  if (status !== "Actual" || msgType === "Cancel" || (scope && scope !== "Public")) return null;
  const sev = tag(xml, "severity");
  const areas = tag(xml, "areaDesc").split(" ").map((s) => s.trim()).filter(Boolean);
  const eff = tag(xml, "effective"), exp = tag(xml, "expires");
  return { id: tag(xml, "identifier").slice(0, 60), event: tag(xml, "event").slice(0, 80), headline: tag(xml, "headline").slice(0, 200), description: tag(xml, "description").slice(0, 1500), instruction: tag(xml, "instruction").slice(0, 800),
    severity: (SEV as readonly string[]).includes(sev) ? (sev as Warning["severity"]) : "Unknown", effective: eff || null, expires: exp || null, areas, link };
}
/** Whether the alert is in force at `now` (a missing time does not hide it). */
export const inForce = (w: Pick<Warning, "effective" | "expires">, now: Date) => (!w.effective || Date.parse(w.effective) <= now.getTime() + 3_600_000) && (!w.expires || Date.parse(w.expires) > now.getTime());

/** The Thai province(s) a place lies in: the alerts name provinces in Thai. */
export const PROVINCE_TH: Record<string, string> = {
  bangkok: "กรุงเทพมหานคร", pattaya: "ชลบุรี", phuket: "ภูเก็ต", krabi: "กระบี่", "phang-nga": "พังงา", "koh-samui": "สุราษฎร์ธานี", "chiang-mai": "เชียงใหม่", "chiang-rai": "เชียงราย", "mae-hong-son": "แม่ฮ่องสอน",
  "hua-hin": "ประจวบคีรีขันธ์", ayutthaya: "พระนครศรีอยุธยา", kanchanaburi: "กาญจนบุรี", "khon-kaen": "ขอนแก่น", "udon-thani": "อุดรธานี", "nakhon-ratchasima": "นครราชสีมา", "ubon-ratchathani": "อุบลราชธานี", sukhothai: "สุโขทัย",
  trat: "ตราด", rayong: "ระยอง", "hat-yai": "สงขลา", trang: "ตรัง", satun: "สตูล", "nakhon-si-thammarat": "นครศรีธรรมราช", nan: "น่าน", loei: "เลย",
};
/** The alerts in force that name the place's province. Newest first, the same event only once (the feed repeats updates of one warning). */
export function warningsFor(place: Pick<Place, "slug">, all: Warning[], now: Date): Warning[] {
  const prov = PROVINCE_TH[place.slug]; if (!prov) return [];
  const seen = new Set<string>(), out: Warning[] = [];
  for (const w of [...all].sort((a, b) => Date.parse(b.effective ?? "") - Date.parse(a.effective ?? "") || 0)) {
    if (!inForce(w, now) || !w.areas.some((a) => a === prov || a.includes(prov))) continue;
    const k = `${w.event}|${w.severity}`; if (seen.has(k)) continue; seen.add(k); out.push(w);
  }
  return out.slice(0, 4);
}
export const warningLevel = (s: Warning["severity"]): "info" | "caution" | "warning" => (s === "Extreme" || s === "Severe" ? "warning" : s === "Moderate" ? "caution" : "info");
