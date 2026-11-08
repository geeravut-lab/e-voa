// Accessibility check of the public pages with axe-core in a real browser (WCAG 2.0/2.1 A and AA).
// Needs a running site (npm run build && npm start, or npm run dev) and Playwright: node scripts/a11y.mjs [baseUrl]
// Exits 1 when a page has a "serious" or "critical" problem; lesser ones are listed but do not fail the run.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = ["/", "/eligibility", "/fees", "/prepare", "/guide", "/help", "/extras", "/status", "/official", "/privacy", "/terms", "/articles", "/news", "/login", "/toolkit", "/emergency", "/stay", "/tdac", "/check-rules", "/phrases", "/conditions", "/incident", "/incident/road-accident", "/rental", "/offline-vault.html", "/family", "/family/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "/pay/link/not-a-real-link"];
const VIEWPORTS = [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]];
const FAIL_ON = new Set(["serious", "critical"]);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
let failed = 0; const seen = new Map();
for (const [vname, vp] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    try { await page.goto(base + path, { waitUntil: "networkidle", timeout: 60_000 }); } catch (e) { console.log(`✕ ${vname} ${path}: could not open (${e.message.split("\n")[0]})`); failed++; continue; }
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }));
    for (const v of res.violations) {
      const key = `${v.id}|${path}`; const row = seen.get(key) ?? { id: v.id, impact: v.impact, path, where: new Set(), n: 0, help: v.help, sample: v.nodes[0]?.target?.join(" ") ?? "" };
      row.where.add(vname); row.n += v.nodes.length; seen.set(key, row);
    }
    if (!res.violations.length) console.log(`✓ ${vname} ${path}`);
  }
  await ctx.close();
}
await browser.close();
for (const r of seen.values()) { const bad = FAIL_ON.has(r.impact); if (bad) failed++; console.log(`${bad ? "✕" : "·"} [${r.impact}] ${r.id} on ${r.path} (${[...r.where].join("+")}, ${r.n} element${r.n === 1 ? "" : "s"}): ${r.help} — e.g. ${r.sample}`); }
console.log(failed ? `\n${failed} problem(s) to fix.` : "\nNo serious or critical accessibility problems.");
process.exit(failed ? 1 : 0);
