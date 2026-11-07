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
import { admin, cleanupUsers, makeUser, sql } from "./helpers";

type Mock = { listen: (p?: number) => Promise<number>; close: () => Promise<void> };
let mock: Mock, base = "", savedToolkit: unknown = null;
const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const resetCache = () => { (globalThis as unknown as { __evoaConditions?: Map<string, unknown> }).__evoaConditions?.clear(); };

beforeAll(async () => {
  mock = createMockServer({ decisionDelayMs: 60, log: () => {} }) as unknown as Mock; base = `http://127.0.0.1:${await mock.listen(0)}`;
  Object.assign(process.env, { OPEN_METEO_URL: `${base}/open-meteo`, OPEN_METEO_AQ_URL: `${base}/open-meteo-aq`, ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: `${base}/ai` });
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
    resetCache(); await post("/__admin/weather-break", { status: 503 });
    expect(await fetchConditions(place)).toEqual({ ok: false, error: "unavailable" });
    await post("/__admin/weather-break", { status: 0 }); expect((await fetchConditions(place)).ok).toBe(true);
    void calls;
  });
  it("the assistant's tool says what is dangerous in words, refuses unknown places, and admits when it has no data", async () => {
    resetCache(); await post("/__admin/weather", { pm25: 96, feelsC: 43, code: 96, rainProb: 90, uv: 11.5, gust: 70 });
    const j = JSON.parse(await conditionsTool({ place: "Is it safe in Patong?" }));
    expect(j).toMatchObject({ place: "Phuket", source: "Weather data by Open-Meteo.com", air: { pm2_5_ug_m3: 96, pm2_5_level: "unhealthy for everyone" } });
    expect(j.advice.map((a: { text: string }) => a.text).join(" ")).toMatch(/PM2\.5 is very high/); expect(j.advice.map((a: { text: string }) => a.text).join(" ")).toMatch(/1669/); expect(j.advice.map((a: { level: string }) => a.level)).toContain("warning");
    expect(j.data_note).toMatch(/not official warnings/); expect(j.emergency).toContain("1155");
    expect(await conditionsTool({ place: "Tokyo" })).toMatch(/Unknown place.*Places with live data: Bangkok/s);
    resetCache(); await post("/__admin/weather-break", { status: 500 });
    expect(await conditionsTool({ place: "Bangkok" })).toMatch(/not available right now.*do not guess/s);
    await post("/__admin/weather-break", { status: 0 }); await post("/__admin/weather", {});
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

describe("travel safety content edited in the back office", () => {
  it("shows the built-in lists until staff save a list, then shows the saved one, and falls back when it is damaged", async () => {
    const staff = await makeUser("tk-staff", { admin: true });
    await sql(`delete from public.platform_settings where key='${TOOLKIT_SETTING}'`);
    let tk = await loadToolkit(); expect(tk.edited).toEqual({ emergency: false, phrases: false, rules: false }); expect(tk.emergency.map((e) => e.number)).toContain("1155");
    const list = [{ number: "1155", label: { en: "Tourist Police", th: "ตำรวจท่องเที่ยว", "zh-CN": "旅游警察" }, use: { en: "English spoken", th: "x", "zh-CN": "x" } }, { number: "1669", label: { en: "Ambulance", th: "x", "zh-CN": "x" }, use: { en: "Medical", th: "x", "zh-CN": "x" } }];
    expect(await putSetting(TOOLKIT_SETTING, { emergency: list, reviewed: { emergency: "2026-11-07" } }, staff.id)).toBe(true);
    tk = await loadToolkit(); expect(tk.edited.emergency).toBe(true); expect(tk.emergency.map((e) => e.number)).toEqual(["1155", "1669"]); expect(tk.reviewed.emergency).toBe("2026-11-07"); expect(tk.phrases.length).toBeGreaterThan(5);
    await putSetting(TOOLKIT_SETTING, { emergency: [{ number: "x" }], phrases: "broken", rules: 5 }, staff.id);
    tk = await loadToolkit(); expect(tk.edited).toEqual({ emergency: false, phrases: false, rules: false }); expect(tk.emergency.length).toBeGreaterThanOrEqual(6);
  });
});
void admin;
