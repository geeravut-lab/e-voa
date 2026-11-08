// The editable part of "While in Thailand": emergency numbers, Thai phrases and the rules check. PURE (no server imports): the pages, the back-office form,
// the offline page and the tests share it. The built-in lists in toolkit.ts are the fallback, so a missing or damaged setting never breaks a page (rule 9).
import { EMERGENCY, PHRASES, RULES_CHECK, type Emergency, type Phrase, type RuleItem } from "./toolkit";
import { INCIDENTS, type Incident } from "./incidents";
import { EXTRA_LANGS, type PerLang } from "./types";

export type ToolkitContent = { emergency: Emergency[]; phrases: Phrase[]; rules: RuleItem[]; incidents: Incident[] };
export type ToolkitKind = keyof ToolkitContent;
export const KINDS: ToolkitKind[] = ["emergency", "phrases", "rules", "incidents"];
export const BUILTIN: ToolkitContent = { emergency: EMERGENCY, phrases: PHRASES, rules: RULES_CHECK, incidents: INCIDENTS };
export const LIMITS = { emergency: 12, phrases: 40, rules: 30, incidents: 16, steps: 12, step: 300, summary: 200, label: 80, use: 200, th: 80, roman: 100, meaning: 100, title: 100, text: 700 } as const;
const LEVELS = ["illegal", "restricted", "respect", "careful"] as const;
const THAI = /[฀-๿]/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const three = (o: unknown, max: number): PerLang<string> | null => {
  const m = (o && typeof o === "object" ? o : {}) as Record<string, unknown>, en = str(m.en, max);
  return en ? { en, th: str(m.th, max) || en, "zh-CN": str(m["zh-CN"], max) || en } : null;      // English is required; another language left empty shows the English text
};

function cleanEmergency(raw: unknown): Emergency[] {
  const seen = new Set<string>(), out: Emergency[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>, number = str(o.number, 8), label = three(o.label, LIMITS.label), use = three(o.use, LIMITS.use);
    if (!/^\d{3,6}$/.test(number) || !label || !use || seen.has(number)) continue;
    seen.add(number); out.push({ number, label, use });
  }
  return out.slice(0, LIMITS.emergency);
}
function cleanPhrases(raw: unknown): Phrase[] {
  const out: Phrase[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>, th = str(o.th, LIMITS.th), roman = str(o.roman, LIMITS.roman), en = str(o.en, LIMITS.meaning), zh = str(o.zh, LIMITS.meaning) || en;
    if (!THAI.test(th) || !en) continue;
    out.push({ id: `c${out.length}`, urgent: o.urgent === true || undefined, th, roman, en, zh });
  }
  return out.slice(0, LIMITS.phrases);
}
function cleanRules(raw: unknown): RuleItem[] {
  const out: RuleItem[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>, title = three(o.title, LIMITS.title), text = three(o.text, LIMITS.text), level = LEVELS.find((l) => l === o.level);
    if (!title || !text || !level) continue;
    out.push({ id: `c${out.length}`, level, title, text });
  }
  return out.slice(0, LIMITS.rules);
}
/** Lines keep their line breaks (one step per line); every line is trimmed and cut. */
const linesOf = (v: unknown, perLine: number, maxLines: number): string[] => (typeof v === "string" ? v.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim().slice(0, perLine)).filter(Boolean).slice(0, maxLines) : []);
function cleanIncidents(raw: unknown): Incident[] {
  const out: Incident[] = [], used = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r ?? {}) as Record<string, unknown>, title = three(o.title, LIMITS.title), summary = three(o.summary, LIMITS.summary), st = (o.steps && typeof o.steps === "object" ? o.steps : {}) as Record<string, unknown>;
    const en = linesOf(st.en, LIMITS.step, LIMITS.steps); if (!title || !summary || en.length === 0) continue;
    const th = linesOf(st.th, LIMITS.step, LIMITS.steps), zh = linesOf(st["zh-CN"], LIMITS.step, LIMITS.steps);
    let id = str(o.id, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `case-${out.length + 1}`; while (used.has(id)) id += "-x"; used.add(id);
    const call = (Array.isArray(o.call) ? o.call : []).map((n) => str(n, 8)).filter((n) => /^\d{3,6}$/.test(n)).slice(0, 4);
    out.push({ id, call, title, summary, steps: { en, th: th.length ? th : en, "zh-CN": zh.length ? zh : en } });
  }
  return out.slice(0, LIMITS.incidents);
}
const CLEAN = { emergency: cleanEmergency, phrases: cleanPhrases, rules: cleanRules, incidents: cleanIncidents } as const;

/**
 * The back-office form edits English, Thai and Chinese only. A built-in item the staff did not change keeps its translations into the six later languages
 * (matched by number / id / English text); an item they rewrote shows English in those languages until a translation is added in code.
 */
function carryExtras(c: Partial<ToolkitContent>): Partial<ToolkitContent> {
  const copy = <T extends string | string[]>(to: PerLang<T>, from: PerLang<T>) => { for (const l of EXTRA_LANGS) if (from[l] !== undefined) to[l] = from[l]; };
  const same = (a: string[] | string, b: string[] | string) => (Array.isArray(a) ? a.join("\n") === (b as string[]).join("\n") : a === b);
  for (const e of c.emergency ?? []) { const b = EMERGENCY.find((x) => x.number === e.number); if (!b) continue; if (b.label.en === e.label.en) copy(e.label, b.label); if (b.use.en === e.use.en) copy(e.use, b.use); }
  for (const p of c.phrases ?? []) { const b = PHRASES.find((x) => x.th === p.th); if (b?.more && b.en === p.en) p.more = { ...b.more }; }
  for (const r of c.rules ?? []) { const b = RULES_CHECK.find((x) => x.title.en === r.title.en); if (!b) { const t = RULES_CHECK.find((x) => x.text.en === r.text.en); if (t) copy(r.text, t.text); continue; } copy(r.title, b.title); if (b.text.en === r.text.en) copy(r.text, b.text); }
  for (const i of c.incidents ?? []) { const b = INCIDENTS.find((x) => x.id === i.id); if (!b) continue; if (b.title.en === i.title.en) copy(i.title, b.title); if (b.summary.en === i.summary.en) copy(i.summary, b.summary); if (same(b.steps.en, i.steps.en)) copy(i.steps, b.steps); }
  return c;
}

/** The stored setting, with every list cleaned: bad items are dropped, an empty list counts as "not edited". */
export function parseToolkit(raw: unknown): Partial<ToolkitContent> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, out: Partial<ToolkitContent> = {};
  for (const k of KINDS) { const list = CLEAN[k](o[k]); if (list.length) (out as Record<string, unknown>)[k] = list; }
  return carryExtras(out);
}
/** What the pages show: the edited list when there is one, otherwise the built-in one. */
export const mergeToolkit = (stored: Partial<ToolkitContent>): ToolkitContent => ({ emergency: stored.emergency ?? BUILTIN.emergency, phrases: stored.phrases ?? BUILTIN.phrases, rules: stored.rules ?? BUILTIN.rules, incidents: stored.incidents ?? BUILTIN.incidents });

// ---------------------------------------------------------------- the back-office form
type Form = { get(k: string): unknown };
export const FORM_ROWS = 60;
const v = (f: Form, k: string) => String(f.get(k) ?? "");
const tri = (f: Form, p: string) => ({ en: v(f, `${p}.en`), th: v(f, `${p}.th`), "zh-CN": v(f, `${p}.zh`) });

/** Reads one list from the form (rows `kind.<i>.field`; a row with "delete" ticked or nothing in it is dropped). Returns an err_* code instead of throwing. */
export function parseToolkitForm(kind: ToolkitKind, f: Form): { ok: true; list: unknown[] } | { ok: false; error: string } {
  const rows: unknown[] = [];
  for (let i = 0; i < FORM_ROWS; i++) {
    const p = `${kind}.${i}`;
    if (f.get(`${p}.del`) === "on") continue;
    if (kind === "emergency") { const number = v(f, `${p}.number`).trim(); if (!number && !v(f, `${p}.label.en`).trim()) continue; rows.push({ number, label: tri(f, `${p}.label`), use: tri(f, `${p}.use`) }); }
    else if (kind === "phrases") { if (!v(f, `${p}.th`).trim() && !v(f, `${p}.en`).trim()) continue; rows.push({ th: v(f, `${p}.th`), roman: v(f, `${p}.roman`), en: v(f, `${p}.en`), zh: v(f, `${p}.zh`), urgent: f.get(`${p}.urgent`) === "on" }); }
    else if (kind === "incidents") { if (!v(f, `${p}.title.en`).trim() && !v(f, `${p}.steps.en`).trim()) continue; rows.push({ id: v(f, `${p}.id`), call: v(f, `${p}.call`).split(/[\s,;]+/).filter(Boolean), title: tri(f, `${p}.title`), summary: tri(f, `${p}.summary`), steps: { en: v(f, `${p}.steps.en`), th: v(f, `${p}.steps.th`), "zh-CN": v(f, `${p}.steps.zh`) } }); }
    else { if (!v(f, `${p}.title.en`).trim() && !v(f, `${p}.text.en`).trim()) continue; rows.push({ level: v(f, `${p}.level`), title: tri(f, `${p}.title`), text: tri(f, `${p}.text`) }); }
  }
  if (rows.length === 0) return { ok: false, error: "err_toolkit_empty" };
  if (rows.length > LIMITS[kind]) return { ok: false, error: "err_toolkit_too_many" };
  const cleaned = CLEAN[kind](rows);
  if (cleaned.length !== rows.length) return { ok: false, error: kind === "emergency" ? "err_toolkit_number" : kind === "phrases" ? "err_toolkit_thai" : kind === "incidents" ? "err_toolkit_steps" : "err_toolkit_incomplete" };
  return { ok: true, list: cleaned };
}

// ---------------------------------------------------------------- the offline page (a plain HTML page the phone keeps for use without a signal)
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Emergency numbers and the urgent phrases as one self-contained page: no script, no personal data. Built from the same lists the pages show. */
export function renderOfflineEmergency(c: Pick<ToolkitContent, "emergency" | "phrases">): string {
  const nums = c.emergency.map((e) => `<li data-n="${esc(e.number)}"><b>${esc(e.label.en)} / ${esc(e.label.th)}</b><span>${esc(e.use.en)}</span><a class="call" href="tel:${esc(e.number)}">☎ ${esc(e.number)}</a></li>`).join("\n    ");
  const phr = c.phrases.filter((p) => p.urgent).slice(0, 8).map((p) => `<li><span class="th" lang="th">${esc(p.th)}</span><span>${esc(p.roman)} — ${esc(p.en)}</span></li>`).join("\n    ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Emergency numbers – Thailand</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#fbfaf6;color:#0b2545;line-height:1.45}
  main{max-width:640px;margin:0 auto;padding:16px}
  h1{font-size:1.5rem;margin:.2em 0 .6em}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
  li{background:#fff;border:1px solid #e6e2d8;border-radius:16px;padding:12px 14px}
  li b{display:block}
  li span{display:block;color:#4a5b73;font-size:.9rem}
  a.call{display:block;margin-top:8px;text-align:center;background:#c2261c;color:#fff;text-decoration:none;font-weight:800;font-size:1.2rem;padding:12px;border-radius:14px;min-height:24px}
  h2{font-size:1.1rem;margin:1.2em 0 .4em}
  .th{font-size:1.4rem;font-weight:800;color:#1557e0}
  p.note{background:#fff1cc;color:#8a5a00;font-weight:600;padding:10px 12px;border-radius:12px;font-size:.9rem}
</style>
</head>
<body>
<main>
  <h1>Emergency numbers – Thailand</h1>
  <p class="note">This copy works without internet. If one number does not connect, try 191 or 1155. Numbers can change: see the Official channels page when you are online.</p>
  <ul>
    ${nums}
  </ul>
  <h2>Show this to the person helping you</h2>
  <ul>
    ${phr}
  </ul>
</main>
</body>
</html>
`;
}
