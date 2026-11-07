import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ageMinutes, parseStations, pickStation } from "@/lib/conditions/air4thai";
import { PROVINCE_TH, inForce, parseCapAlert, parseCapFeed, warningLevel, warningsFor } from "@/lib/conditions/tmd";
import { PLACES, findPlace } from "@/lib/conditions/places";

const read = (f: string) => readFileSync(`src/lib/conditions/${f}`, "utf8");
// "now" for the samples: 08 Nov 2026 03:30 Thai time (the samples were taken at 03:00 / 16:00 the day before)
const NOW = new Date("2026-11-08T03:30:00+07:00");

describe("Air4Thai (real sample)", () => {
  const stations = parseStations(JSON.parse(read("fixtures-air4thai.json")));
  it("reads stations: numbers from text, \"-1\" as no reading", () => {
    expect(stations).toHaveLength(3);
    const krabi = stations.find((s) => s.id === "119t")!; expect(krabi).toMatchObject({ nameEN: "Thara Public Park", lat: 8.0506237, lon: 98.9180489, pm25: 8.7, pm10: null, thaiAqi: 15, at: "2026-11-08T03:00" });
    expect(stations.find((s) => s.id === "105t")!.pm25).toBeNull();
  });
  it("is robust to junk", () => { for (const j of [null, "x", {}, { stations: "no" }, { stations: [null, 5, { lat: "x" }, { lat: "50", long: "10" }] }]) expect(parseStations(j)).toEqual([]); });
  it("picks the nearest station with a fresh PM2.5 reading, within 40 km", () => {
    const krabi = findPlace("krabi")!, p = pickStation(stations, krabi, NOW)!;
    expect(p.station.id).toBe("119t"); expect(p.distanceKm).toBeLessThan(10); expect(p.ageMin).toBe(30);
    expect(pickStation(stations, findPlace("chiang-mai")!, NOW)).toBeNull();                          // far from every sample station
    expect(pickStation(stations, krabi, new Date("2026-11-08T12:00:00+07:00"))).toBeNull();           // reading is 9 hours old
    expect(pickStation(stations, krabi, new Date("2026-11-08T01:00:00+07:00"))).toBeNull();           // a time in the future is not trusted
    expect(ageMinutes(null, NOW)).toBeNull();
  });
});

describe("TMD warnings (real sample)", () => {
  it("lists the feed's items and keeps only links on the department's own site", () => {
    const items = parseCapFeed(read("fixtures-tmd-feed.xml"));
    expect(items).toHaveLength(2); expect(items[0]).toMatchObject({ title: "ฝนตกหนัก" }); expect(items[0].link).toMatch(/^https:\/\/www\.tmd\.go\.th\/uploads\/CAP\/.+\.xml$/);
    const evil = `<rss><channel><item><title>x</title><link>https://evil.example.com/a.xml</link></item><item><title>y</title><link>http://www.tmd.go.th/uploads/CAP/a.xml</link></item><item><title>z</title><link>https://www.tmd.go.th/../etc/passwd</link></item></channel></rss>`;
    expect(parseCapFeed(evil)).toEqual([]); expect(parseCapFeed("<html>")).toEqual([]);
  });
  const w = parseCapAlert(read("fixtures-tmd-cap.xml"), "https://www.tmd.go.th/uploads/CAP/CAPTMD20261107160513_2.xml")!;
  it("reads one alert", () => {
    expect(w).toMatchObject({ id: "TMD20261107160513_2", event: "Heavy Rain", severity: "Severe", effective: "2026-11-07T16:00:00+07:00", expires: "2026-11-08T06:00:00+07:00" });
    expect(w.areas).toContain("ภูเก็ต"); expect(w.areas).toContain("เชียงใหม่"); expect(w.areas).not.toContain("กรุงเทพมหานคร"); expect(w.description).toContain("ภาคใต้"); expect(w.instruction.length).toBeGreaterThan(20);
  });
  it("ignores test, cancelled and non-public alerts and anything that is not CAP", () => {
    const x = read("fixtures-tmd-cap.xml");
    expect(parseCapAlert(x.replace("<status>Actual</status>", "<status>Test</status>"))).toBeNull(); expect(parseCapAlert(x.replace("<msgType>Update</msgType>", "<msgType>Cancel</msgType>"))).toBeNull();
    expect(parseCapAlert(x.replace("<scope>Public</scope>", "<scope>Private</scope>"))).toBeNull(); expect(parseCapAlert("<html>no</html>")).toBeNull();
  });
  it("is in force between its start (an hour of lead is allowed) and its end", () => {
    expect(inForce(w, NOW)).toBe(true); expect(inForce(w, new Date("2026-11-08T07:00:00+07:00"))).toBe(false); expect(inForce(w, new Date("2026-11-07T10:00:00+07:00"))).toBe(false); expect(inForce({ effective: null, expires: null }, NOW)).toBe(true);
  });
  it("is matched to a place by its province name in Thai, once per event", () => {
    expect(warningsFor(findPlace("phuket")!, [w], NOW)).toHaveLength(1); expect(warningsFor(findPlace("chiang-mai")!, [w], NOW)).toHaveLength(1);
    expect(warningsFor(findPlace("bangkok")!, [w], NOW)).toEqual([]); expect(warningsFor(findPlace("phuket")!, [w], new Date("2026-11-09T00:00:00+07:00"))).toEqual([]);
    expect(warningsFor(findPlace("phuket")!, [w, { ...w, id: "later" }], NOW)).toHaveLength(1);
    expect(warningLevel("Severe")).toBe("warning"); expect(warningLevel("Moderate")).toBe("caution"); expect(warningLevel("Minor")).toBe("info"); expect(warningLevel("Unknown")).toBe("info");
  });
  it("knows the province of every place", () => { for (const p of PLACES) expect(PROVINCE_TH[p.slug], p.slug).toBeTruthy(); });
});
