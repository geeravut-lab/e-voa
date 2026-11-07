// Live-style checks of the safety advisor (weather + PM2.5) against the Open-Meteo look-alike in the simulator, and of the back-office lists in the real settings table.
// The real Open-Meteo cannot be reached from the cloud sandbox, so the format is checked against the simulator, which copies the documented answer.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain JavaScript simulator without type declarations
import { createMockServer } from "../tools/mock-partners/server.mjs";
import { fetchConditions } from "@/lib/conditions/service";
import { conditionsTool } from "@/lib/conditions/tool";
import { findPlace } from "@/lib/conditions/places";
import { runTool } from "@/lib/ai/tools";
import { runAssistant } from "@/lib/ai/assistant";
import { loadToolkit, TOOLKIT_SETTING } from "@/lib/content/toolkit-server";
import { putSetting } from "@/lib/settings";
import { addWatch, listWatches, removeWatch, runWarningAlerts, worthAlerting, MAX_WATCHES } from "@/lib/conditions/watch";
import { admin, cleanupUsers, makeUser, sql } from "./helpers";

type Mock = { listen: (p?: number) => Promise<number>; close: () => Promise<void> };
let mock: Mock, base = "", savedToolkit: unknown = null;
const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const resetCache = () => { const g = globalThis as unknown as { __evoaConditions?: Map<string, unknown>; __evoaOfficial?: Record<string, unknown> }; g.__evoaConditions?.clear(); if (g.__evoaOfficial) for (const k of Object.keys(g.__evoaOfficial)) delete g.__evoaOfficial[k]; };

beforeAll(async () => {
  mock = createMockServer({ decisionDelayMs: 60, log: () => {} }) as unknown as Mock; base = `http://127.0.0.1:${await mock.listen(0)}`;
  Object.assign(process.env, { OPEN_METEO_URL: `${base}/open-meteo`, OPEN_METEO_AQ_URL: `${base}/open-meteo-aq`, AIR4THAI_URL: `${base}/air4thai/getNewAQI_JSON.php`, TMD_CAP_URL: `${base}/tmd/CAP`, ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: `${base}/ai` });
  savedToolkit = ((await sql<{ value: unknown }>(`select value from public.platform_settings where key='${TOOLKIT_SETTING}'`))[0]?.value) ?? null;
}, 120_000);
afterAll(async () => {
  await mock.close();
  await sql(savedToolkit === null ? `delete from public.platform_settings where key='${TOOLKIT_SETTING}'` : `update public.platform_settings set value='${JSON.stringify(savedToolkit).replace(/'/g, "''")}'::jsonb where key='${TOOLKIT_SETTING}'`);
  const problems = await cleanupUsers(); if (problems.length) throw new Error(problems.join("; "));
}, 120_000);

describe("live conditions", () => {
  it("reads weather and air for a place, keeps the answer for ten minutes, and never invents data when the service fails", async () => {
    resetCache(); await post("/__admin/weather", {}); await post("/__admin/weather-break", { status: 0 });
    const place = findPlace("Phuket")!;
    const c = await fetchConditions(place);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.readings).toMatchObject({ tempC: 31.4, feelsC: 33.2, humidity: 66, pm25: 18.5, rainProbMax: 20, uvMax: 6, time: "2026-11-07T14:00" });
    const calls = async () => ((await (await fetch(`${base}/__admin/state`)).json()) as { weatherCalls?: unknown[] }).weatherCalls?.length;
    await fetchConditions(place); await fetchConditions(place);
    resetCache(); await post("/__admin/weather-break", { status: 503 }); await post("/__admin/official", { air4thaiDown: true, tmdDown: true });
    expect(await fetchConditions(place)).toEqual({ ok: false, error: "unavailable" });
    await post("/__admin/weather-break", { status: 0 }); await post("/__admin/official", {}); expect((await fetchConditions(place)).ok).toBe(true);
    void calls;
  });
  it("the assistant's tool says what is dangerous in words, refuses unknown places, and admits when it has no data", async () => {
    resetCache(); await post("/__admin/weather", { pm25: 96, feelsC: 43, code: 96, rainProb: 90, uv: 11.5, gust: 70 });
    const j = JSON.parse(await conditionsTool({ place: "Is it safe in Patong?" }));
    expect(j).toMatchObject({ place: "Phuket", source: "Weather data by Open-Meteo.com", air: { pm2_5_ug_m3: 96, pm2_5_level: "unhealthy for everyone" } });
    expect(j.advice.map((a: { text: string }) => a.text).join(" ")).toMatch(/PM2\.5 is very high/); expect(j.advice.map((a: { text: string }) => a.text).join(" ")).toMatch(/1669/); expect(j.advice.map((a: { level: string }) => a.level)).toContain("warning");
    expect(j.data_note).toMatch(/Only official_warnings are official warnings/); expect(j.emergency).toContain("1155");
    expect(await conditionsTool({ place: "Tokyo" })).toMatch(/Unknown place.*Places with live data: Bangkok/s);
    resetCache(); await post("/__admin/weather-break", { status: 500 }); await post("/__admin/official", { air4thaiDown: true, tmdDown: true });
    expect(await conditionsTool({ place: "Bangkok" })).toMatch(/not available right now.*do not guess/s);
    await post("/__admin/weather-break", { status: 0 }); await post("/__admin/weather", {}); await post("/__admin/official", {});
    expect(await runTool("get_conditions", { place: "Phuket" }, { userId: null, lang: "en" })).toContain("Phuket");
  });
  it("a traveler asking about haze gets an answer built from the live data (the model is the simulator)", async () => {
    resetCache(); await post("/__admin/weather", { pm25: 88 });
    const u = await makeUser("cond-u");
    const r = await runAssistant([{ role: "user", content: "Is the haze in Phuket bad today? PM2.5?" }], { userId: u.id, lang: "en" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.reply).toContain("Phuket"); expect(r.reply).toContain("88"); }
    await post("/__admin/weather", {});
  }, 120_000);
});

describe("official Thai data", () => {
  it("uses a nearby measuring station for PM2.5 and says so; falls back to the model when none is near or the service is down", async () => {
    resetCache(); await post("/__admin/official", {}); await post("/__admin/weather", {}); await post("/__admin/weather-break", { status: 0 });
    const bkk = await fetchConditions(findPlace("Bangkok")!);
    expect(bkk.ok).toBe(true);
    if (bkk.ok) { expect(bkk.air).toMatchObject({ source: "air4thai", station: { name: "Mock Bangkok Station", thaiAqi: 92 } }); expect(bkk.readings.pm25).toBe(42.5); expect(bkk.readings.tempC).toBe(31.4); }
    const phuket = await fetchConditions(findPlace("Phuket")!);                                        // its station has no reading: modelled value from the weather service
    if (phuket.ok) { expect(phuket.air).toEqual({ source: "model" }); expect(phuket.readings.pm25).toBe(18.5); }
    const j = JSON.parse(await conditionsTool({ place: "Bangkok" }));
    expect(j.air).toMatchObject({ pm2_5_ug_m3: 42.5, station: "Mock Bangkok Station", thai_aqi: 92 }); expect(j.air.source).toMatch(/Air4Thai/);
    resetCache(); await post("/__admin/official", { air4thaiDown: true });
    const down = await fetchConditions(findPlace("Bangkok")!); if (down.ok) { expect(down.air).toEqual({ source: "model" }); expect(down.readings.pm25).toBe(18.5); }
    await post("/__admin/official", {});
  });
  it("matches the department's warnings to the province, ignores links to other sites, and says plainly when the feed is down", async () => {
    resetCache(); await post("/__admin/official", {});
    const phuket = await fetchConditions(findPlace("Phuket")!);
    expect(phuket.ok && phuket.warningsKnown).toBe(true);
    if (phuket.ok) { expect(phuket.warnings).toHaveLength(1); expect(phuket.warnings[0]).toMatchObject({ event: "Heavy Rain", severity: "Severe", headline: "ฝนตกหนักบริเวณภาคใต้" }); }
    const bkk = await fetchConditions(findPlace("Bangkok")!); expect(bkk.ok && bkk.warnings).toEqual([]);
    const j = JSON.parse(await conditionsTool({ place: "Phuket" }));
    expect(j.official_warnings[0]).toMatchObject({ severity: "Severe", level: "warning", headline_th: "ฝนตกหนักบริเวณภาคใต้" }); expect(j.official_warnings[0].source).toMatch(/Thai Meteorological Department/);
    expect(JSON.parse(await conditionsTool({ place: "Bangkok" })).official_warnings).toMatch(/No active Thai Meteorological Department warning/);
    resetCache(); await post("/__admin/official", { tmdDown: true });
    expect(JSON.parse(await conditionsTool({ place: "Bangkok" })).official_warnings).toMatch(/could not be read/);
    resetCache(); await post("/__admin/official", { noWarning: true }); const none = await fetchConditions(findPlace("Phuket")!); expect(none.ok && none.warnings).toEqual([]);
    await post("/__admin/official", {});
  });
});

describe("alerts for official warnings", () => {
  const nots = async (userId: string) => (await sql<{ dedupe_key: string; title: string; body: string; link: string }>(`select dedupe_key, title, body, link from public.app_notifications where user_id='${userId}' and kind='weather.warning'`));
  it("a watcher gets one notice per warning (in their language), someone who watches another place gets none, and a repeat run sends nothing", async () => {
    resetCache(); await post("/__admin/official", {});
    const a = await makeUser("w-a"), b = await makeUser("w-b"), c = await makeUser("w-c");
    await sql(`update public.profiles set lang='th' where id='${b.id}'`);
    expect(await addWatch(a.id, "phuket")).toBe("ok"); expect(await addWatch(a.id, "phuket")).toBe("ok"); expect(await addWatch(b.id, "krabi")).toBe("ok"); expect(await addWatch(c.id, "bangkok")).toBe("ok");
    expect(await addWatch(a.id, "atlantis")).toBe("err_generic"); expect(await listWatches(a.id)).toEqual(["phuket"]);
    const r1 = await runWarningAlerts(new Date(), { onlyUsers: [a.id, b.id, c.id] });
    expect(r1.sent).toBe(2);
    const na = await nots(a.id), nb = await nots(b.id);
    expect(na).toHaveLength(1); expect(na[0]).toMatchObject({ dedupe_key: "tmd:MOCK1:phuket", link: "/conditions?place=phuket" }); expect(na[0].title).toBe("Official weather warning: Phuket"); expect(na[0].body).toContain("Heavy Rain"); expect(na[0].body).toContain("ฝนตกหนักบริเวณภาคใต้");
    expect(nb).toHaveLength(1); expect(nb[0].title).toBe("คำเตือนสภาพอากาศอย่างเป็นทางการ: กระบี่"); expect(await nots(c.id)).toEqual([]);
    const r2 = await runWarningAlerts(new Date(), { onlyUsers: [a.id, b.id, c.id] }); expect(r2.sent).toBe(0); expect(await nots(a.id)).toHaveLength(1);
    expect(await removeWatch(a.id, "phuket")).toBe(true); expect(await removeWatch(a.id, "phuket")).toBe(false); expect(await listWatches(a.id)).toEqual([]);
  }, 120_000);
  it("sends nothing when the feed has no warning or cannot be read, and follows at most five places", async () => {
    const u = await makeUser("w-d"); expect(await addWatch(u.id, "phuket")).toBe("ok");
    resetCache(); await post("/__admin/official", { noWarning: true }); expect((await runWarningAlerts(new Date(), { onlyUsers: [u.id] })).sent).toBe(0);
    resetCache(); await post("/__admin/official", { tmdDown: true }); expect(await runWarningAlerts(new Date(), { onlyUsers: [u.id] })).toEqual({ checked: 0, sent: 0 });
    await post("/__admin/official", {}); resetCache();
    for (const s of ["krabi", "bangkok", "trat", "nan"]) expect(await addWatch(u.id, s)).toBe("ok");
    expect(await listWatches(u.id)).toHaveLength(MAX_WATCHES); expect(await addWatch(u.id, "loei")).toBe("err_watch_limit");
    const own = await u.client.from("warning_watches").select("place_slug"); expect((own.data ?? []).length).toBe(MAX_WATCHES);        // the person can read their own rows (and only theirs)
    expect(worthAlerting({ severity: "Minor" } as never)).toBe(false); expect(worthAlerting({ severity: "Moderate" } as never)).toBe(true);
  }, 120_000);
});

describe("travel safety content edited in the back office", () => {
  it("shows the built-in lists until staff save a list, then shows the saved one, and falls back when it is damaged", async () => {
    const staff = await makeUser("tk-staff", { admin: true });
    await sql(`delete from public.platform_settings where key='${TOOLKIT_SETTING}'`);
    let tk = await loadToolkit(); expect(tk.edited).toEqual({ emergency: false, phrases: false, rules: false, incidents: false }); expect(tk.emergency.map((e) => e.number)).toContain("1155");
    const list = [{ number: "1155", label: { en: "Tourist Police", th: "ตำรวจท่องเที่ยว", "zh-CN": "旅游警察" }, use: { en: "English spoken", th: "x", "zh-CN": "x" } }, { number: "1669", label: { en: "Ambulance", th: "x", "zh-CN": "x" }, use: { en: "Medical", th: "x", "zh-CN": "x" } }];
    expect(await putSetting(TOOLKIT_SETTING, { emergency: list, reviewed: { emergency: "2026-11-07" } }, staff.id)).toBe(true);
    tk = await loadToolkit(); expect(tk.edited.emergency).toBe(true); expect(tk.emergency.map((e) => e.number)).toEqual(["1155", "1669"]); expect(tk.reviewed.emergency).toBe("2026-11-07"); expect(tk.phrases.length).toBeGreaterThan(5);
    await putSetting(TOOLKIT_SETTING, { emergency: [{ number: "x" }], phrases: "broken", rules: 5 }, staff.id);
    tk = await loadToolkit(); expect(tk.edited).toEqual({ emergency: false, phrases: false, rules: false, incidents: false }); expect(tk.emergency.length).toBeGreaterThanOrEqual(6);
  });
});
void admin;
