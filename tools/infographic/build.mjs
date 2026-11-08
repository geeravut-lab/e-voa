// Builds the ThaiPass e-VOA infographic: 3 pages x 2 languages (EN, TH) as PNG.
//   npx vite-node tools/infographic/art.tsx /tmp/art.json     (the app's own illustrations and icons as SVG)
//   node tools/infographic/build.mjs /tmp/art.json <out-dir> [<fonts-dir>]
// <fonts-dir> (use . in the repo) must contain node_modules/@fontsource-variable/{plus-jakarta-sans,noto-sans-thai,noto-sans-sc,noto-sans-tc,noto-sans-jp,noto-sans-kr,noto-sans-devanagari,noto-sans-arabic}.
// Playwright is the one that is pre-installed in the cloud sandbox (resolved through require).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { CONTENT } from "./content.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

const [artFile, outDir, fontsArg] = process.argv.slice(2);
const ART = JSON.parse(readFileSync(artFile, "utf8"));
const FONTS = resolve(fontsArg ?? "node_modules");
const W = 1414, H = 2000;
mkdirSync(outDir, { recursive: true });

const icon = (n) => ART[`i_${n}`] ?? "";
const TINT = { rose: ["#FFE3EE", "#D6336C"], sky: ["#E8F1FF", "#1557E0"], mint: ["#DDF7F5", "#0A7C78"], gold: ["#FFF1CC", "#8A5A00"] };
const css = (lang) => `
${["plus-jakarta-sans", "noto-sans-thai", "noto-sans-sc", "noto-sans-tc", "noto-sans-jp", "noto-sans-kr", "noto-sans-devanagari", "noto-sans-arabic"].map((p) => `@import url("file://${FONTS}/node_modules/@fontsource-variable/${p}/index.css");`).join("\n")}
:root{--blue:#1557E0;--teal:#0FB5AE;--teald:#0A7C78;--gold:#FFB627;--goldd:#8A5A00;--lotus:#FF4F8B;--sky:#E8F1FF;--mint:#DDF7F5;--sand:#FFF8EC;--ink:#0B2545;--muted:#4A5B73;--line:#DCE6F5}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:"Plus Jakarta Sans Variable","Noto Sans Thai Variable","Noto Sans SC Variable","Noto Sans TC Variable","Noto Sans JP Variable","Noto Sans KR Variable","Noto Sans Devanagari Variable","Noto Sans Arabic Variable",sans-serif;color:var(--ink);background:#FBFAF6;position:relative;${lang === "th" ? "line-height:1.5;" : "line-height:1.4;"}}
.hero{position:relative;color:#fff;background:linear-gradient(120deg,#1557E0 0%,#1288D6 52%,#0FB5AE 100%);overflow:hidden}
.hero::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-120px;height:200px;background:#FBFAF6;border-radius:50%/100% 100% 0 0}
.dots{position:absolute;right:420px;top:70px;width:230px;height:200px;background-image:radial-gradient(rgba(255,255,255,.5) 3px,transparent 3.5px);background-size:38px 38px;opacity:.7}
.brand{display:flex;align-items:center;gap:18px}
.brand .logo{width:78px;height:78px;border-radius:22px;background:#fff;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.brand .logo img{width:56px;height:56px}
.brand b{font-size:34px;font-weight:800;letter-spacing:-.5px}.brand span{display:block;font-size:19px;opacity:.9;font-weight:600}
.num{flex:none;width:58px;height:58px;border-radius:50%;background:var(--teald);color:#fff;font-weight:800;font-size:28px;display:grid;place-items:center}
.sec{display:flex;align-items:center;gap:18px;margin:0 0 14px}
.sec h2{font-size:34px;font-weight:800;color:var(--teald);white-space:nowrap}
.sec i{flex:1;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--teal),rgba(15,181,174,0))}
.wrap{padding:0 94px}
.grid{display:grid;gap:18px}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
.card{background:#fff;border:2px solid var(--line);border-radius:26px;padding:20px 22px;box-shadow:0 6px 18px -10px rgba(11,37,69,.25);display:flex;gap:18px;align-items:flex-start}
.card.col{flex-direction:column;align-items:center;text-align:center}
.ic{flex:none;width:72px;height:72px;border-radius:50%;display:grid;place-items:center}
.ic svg{width:34px;height:34px}.ic.big{width:88px;height:88px;margin:4px 0 2px}.ic.big svg{width:44px;height:44px}
.card h3{font-size:24px;font-weight:800;margin-bottom:4px}.card p{font-size:19px;color:var(--muted);font-weight:500}
.card.col h3{color:var(--teald)}
.art{width:100%;height:150px;border-radius:18px;overflow:hidden}.art svg{width:100%;height:100%}
.pills{display:flex;flex-wrap:wrap;gap:12px}
.pill{display:inline-flex;align-items:center;gap:10px;background:#fff;border:2px solid var(--line);border-radius:999px;padding:8px 20px 8px 10px;font-size:20px;font-weight:700}
.pill .ic{width:40px;height:40px}.pill .ic svg{width:22px;height:22px}
.lang{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:8px 20px;font-size:22px;font-weight:700;background:#fff;border:2px solid var(--line);color:var(--ink)}
.hero .lang{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.55);color:#fff;font-size:20px;padding:6px 16px}
.band{background:linear-gradient(120deg,#1557E0,#0FB5AE);color:#fff;border-radius:28px;padding:26px 30px}
.callout{border:2px solid #B9E8E4;background:linear-gradient(120deg,var(--mint),var(--sky));border-radius:26px;padding:22px 26px;display:flex;gap:20px;align-items:center}
.callout h3{font-size:26px;font-weight:800;color:var(--teald);margin-bottom:4px}.callout p{font-size:20px;color:var(--ink);font-weight:500}
.foot{position:absolute;left:0;right:0;bottom:0;padding:50px 94px 18px;background:linear-gradient(120deg,#1557E0,#0FB5AE);color:#fff}
.foot::before{content:"";position:absolute;left:-10%;right:-10%;top:-60px;height:120px;background:#FBFAF6;border-radius:0 0 50% 50%/0 0 100% 100%;z-index:0}
.pageno{position:absolute;right:94px;bottom:14px;font-size:18px;opacity:.9;color:#fff;z-index:2}
.phone{position:absolute;right:70px;top:70px;width:330px;height:560px;border-radius:52px;background:var(--ink);padding:14px;transform:rotate(6deg);box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
.screen{width:100%;height:100%;border-radius:40px;background:#fff;color:var(--ink);overflow:hidden;position:relative;padding:34px 22px}
.notch{position:absolute;left:50%;top:10px;width:110px;height:26px;margin-left:-55px;border-radius:14px;background:var(--ink)}
.ok{display:inline-flex;align-items:center;gap:8px;background:#DDF6EA;color:#0E7A4F;border-radius:999px;padding:6px 14px;font-weight:800;font-size:17px}
.qr{width:200px;height:200px;margin:12px auto 0;border:6px solid #fff;box-shadow:0 0 0 2px var(--line);border-radius:14px}
.compact .card{padding:14px 18px;gap:14px;border-radius:22px}.compact .ic{width:58px;height:58px}.compact .ic svg{width:28px;height:28px}.compact .card h3{font-size:22px;margin-bottom:2px}.compact .card p{font-size:17.5px;line-height:1.35}.compact .card.col{padding:14px 16px}.compact .ic.big{width:72px;height:72px;margin:0}.compact .ic.big svg{width:36px;height:36px}.short .art{height:66px}
.banner{display:flex;align-items:center;gap:24px;background:linear-gradient(120deg,#1557E0,#0FB5AE);color:#fff;border-radius:26px;padding:16px 26px 16px 18px}.bart{flex:none;width:190px;height:104px;border-radius:18px;overflow:hidden;background:#fff}.bart svg{width:100%;height:100%}
.step{position:relative}.arrow{position:absolute;right:-27px;top:34%;width:36px;height:36px;border-radius:50%;background:var(--lotus);color:#fff;display:grid;place-items:center;z-index:2;box-shadow:0 4px 10px rgba(255,79,139,.4)}.arrow svg{width:22px;height:22px;stroke-width:3.4}
`;

const tile = (name, tint) => `<span class="ic" style="background:${TINT[tint][0]};color:${TINT[tint][1]}">${icon(name)}</span>`;
const card = (c) => `<div class="card"><div>${tile(c.i, c.t)}</div><div><h3>${c.h}</h3><p>${c.p}</p></div></div>`;
const pill = (c) => `<span class="pill">${tile(c.i, c.t)}${c.h}</span>`;
const sec = (n, h) => `<div class="sec"><span class="num">${n}</span><h2>${h}</h2><i></i></div>`;
const artBox = (name, bg) => `<div class="art" style="background:${bg}">${ART[`art_${name}`] ?? ""}</div>`;

function qrSvg() {
  let s = 7, cells = "";
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 25, finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#0B2545"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0B2545"/>`;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    if (!inF && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#0B2545"/>`;
  }
  return `<svg viewBox="0 0 ${N} ${N}" class="qr" shape-rendering="crispEdges"><rect width="${N}" height="${N}" fill="#fff"/>${cells}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`;
}

function page1(c, lang) {
  const steps = c.steps.map((s, i) => `<div class="step"><div class="card col" style="height:100%">${artBox(s.art, TINT[s.t][0])}<h3>${s.h}</h3><p>${s.p}</p></div>${i < 3 ? `<span class="arrow">${icon("ChevronRight")}</span>` : ""}</div>`).join("");
  return `
<div class="hero" style="height:700px;padding:54px 94px 0">
  <div class="dots"></div>
  <div class="brand"><div class="logo"><img src="${LOGO}"></div><div><b>${c.brand}</b><span>${c.brandSub}</span></div></div>
  <h1 style="margin-top:34px;font-size:${lang === "th" ? 52 : 56}px;line-height:1.14;font-weight:800;max-width:820px">${c.h1[0]}<br><span style="color:#FFE9B0">${c.h1[1]}</span></h1>
  <p style="margin-top:20px;font-size:25px;max-width:780px;opacity:.96;font-weight:500">${c.sub}</p>
  <div style="margin-top:24px;display:inline-flex;align-items:center;gap:12px;background:var(--lotus);border-radius:999px;padding:12px 28px;font-size:24px;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.2)">${icon("Zap")} ${c.cta1}</div>
  <div style="margin-top:22px;display:flex;flex-wrap:wrap;gap:10px;max-width:860px">${c.langs.map((l) => `<span class="lang" ${l[1] ? `dir="${l[1]}"` : ""}>${l[0]}</span>`).join("")}</div>
  <div class="phone"><div class="screen"><div class="notch"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><b style="font-size:21px;color:var(--blue)">E-VOA</b><span class="ok">✓ ${c.phoneOk}</span></div>
    <div style="margin-top:16px;font-size:15px;color:var(--muted)">${c.phoneName}</div><div style="font-size:23px;font-weight:800">ANNA ERIKSSON</div>
    ${qrSvg()}
    <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:15px;color:var(--muted)"><span>${c.phoneRef}</span><b style="color:var(--ink)">EV-26-000123</b></div>
    <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:15px;color:var(--muted)"><span>${c.phoneArr}</span><b style="color:var(--ink)">14 NOV · TG402</b></div>
    <div style="margin-top:14px;text-align:center;font-size:14px;color:var(--muted);background:var(--sky);border-radius:12px;padding:8px">${c.phoneOffline}</div>
  </div></div>
</div>
<div class="wrap" style="margin-top:6px">
  ${sec(1, c.s1)}
  <div class="grid g4" style="margin-bottom:34px">${steps}</div>
  ${sec(2, c.s2)}
  <div class="grid g2" style="margin-bottom:30px">${c.less.map(card).join("")}</div>
  ${sec(3, c.s3)}
  <div class="grid g2">${c.know.map(card).join("")}</div>
</div>
<div class="pageno" style="color:var(--muted)">1 / 3</div>`;
}

function head(c, t, s) {
  return `<div class="hero" style="height:236px;padding:46px 94px 0"><h1 style="font-size:40px;font-weight:800;line-height:1.2">${t}</h1><p style="margin-top:6px;font-size:22px;opacity:.95;font-weight:500">${s}</p></div>`;
}

function page2(c) {
  const b = c.banner;
  return `${head(c, c.p2t, c.p2s)}
<div class="wrap" style="margin-top:14px">
  ${sec(4, c.s4)}
  <div class="banner" style="padding:12px 24px 12px 14px"><div class="bart">${ART[`art_${b.art}`] ?? ""}</div><div><div style="font-size:28px;font-weight:800;line-height:1.25">${b.h}</div><div style="margin-top:6px;font-size:20px;opacity:.95;font-weight:500">${b.p}</div></div></div>
  <div class="grid g2 compact" style="margin:14px 0 12px;gap:14px">${c.safe.map(card).join("")}</div>
  <div class="pills" style="margin-bottom:22px">${c.helpPills.map(pill).join("")}</div>
  ${sec(5, c.s5)}
  <div class="grid g4 compact" style="margin-bottom:8px">${c.addons.map((a) => `<div class="card col"><span class="ic big" style="background:${TINT[a.t][0]};color:${TINT[a.t][1]}">${icon(a.i)}</span><h3>${a.h}</h3><p>${a.p}</p></div>`).join("")}</div>
  <p style="font-size:19px;color:var(--muted);font-weight:600;margin-bottom:18px">${icon("CreditCard").replace("<svg", '<svg style="width:22px;height:22px;vertical-align:-4px;margin-right:8px"')}${c.addonNote}</p>
  ${sec(6, c.s6)}
  <div class="grid g2 compact">${c.money.map(card).join("")}</div>
</div>
<div class="pageno" style="color:var(--muted)">2 / 3</div>`;
}

function page3(c) {
  return `${head(c, c.p3t, c.p3s)}
<div class="wrap" style="margin-top:14px">
  ${sec(7, c.s7)}
  <div class="grid g2 compact" style="margin-bottom:12px;gap:14px">${c.trust.map(card).join("")}</div>
  <div class="callout" style="margin-bottom:16px;padding:16px 22px"><span class="ic" style="background:#fff;color:var(--teald);width:78px;height:78px">${icon("ShieldCheck")}</span><div><h3>${c.callH}</h3><p>${c.callP}</p></div></div>
  ${sec(8, c.s8)}
  <div class="band" style="margin-bottom:10px;padding:14px 22px"><div style="font-size:22px;font-weight:800;margin-bottom:8px">${c.langHead}</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px">${c.langs.map((l) => `<span class="lang" ${l[1] ? `dir="${l[1]}"` : ""} style="font-size:20px;padding:5px 16px">${l[0]}</span>`).join("")}</div>
    <div style="margin-top:8px;font-size:17.5px;opacity:.95;font-weight:500">${c.langNote}</div></div>
  <div class="pills" style="margin-bottom:16px">${c.more.map(pill).join("")}</div>
  ${sec(9, c.s9)}
  <div class="grid g2 compact short" style="margin-bottom:16px">
    <div class="card col" style="align-items:flex-start;text-align:left">${artBox("travelers", TINT.gold[0])}<h3 style="color:var(--teald)">${c.agH}</h3><div class="pills" style="margin-top:6px">${c.ag.map((x) => `<span style="font-size:18px;font-weight:600;color:var(--muted);display:flex;gap:8px;align-items:flex-start"><b style="color:var(--teal)">✓</b>${x}</span>`).join("")}</div></div>
    <div class="card col" style="align-items:flex-start;text-align:left">${artBox("extras", TINT.mint[0])}<h3 style="color:var(--teald)">${c.ptH}</h3><div class="pills" style="margin-top:6px">${c.pt.map((x) => `<span style="font-size:18px;font-weight:600;color:var(--muted);display:flex;gap:8px;align-items:flex-start"><b style="color:var(--teal)">✓</b>${x}</span>`).join("")}</div></div>
  </div>
  ${sec(10, c.s10)}
  <div class="grid g2 compact">${c.ops.map(card).join("")}</div>
</div>
<div class="foot">
  <div style="display:flex;align-items:center;gap:26px;position:relative;z-index:1">
    <div class="brand"><div class="logo" style="width:84px;height:84px"><img src="${LOGO}"></div></div>
    <div style="flex:1"><div style="font-size:34px;font-weight:800;line-height:1.2">${c.endH}</div><div style="font-size:20px;opacity:.95;margin-top:4px">${c.endP}</div></div>
    <div style="background:var(--lotus);border-radius:999px;padding:14px 36px;font-size:28px;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.2)">${c.endBtn}</div>
  </div>
  <div style="margin-top:16px;font-size:16px;opacity:.9;position:relative;z-index:1">${c.disclaimer}</div>
</div>
<div class="pageno" style="bottom:50px;display:none">3 / 3</div>`;
}

const LOGO = `file://${resolve("public/icons/logo-mark.svg")}`;
const browser = await chromium.launch();
for (const lang of ["en", "th"]) {
  const c = CONTENT[lang];
  for (const [i, fn] of [page1, page2, page3].entries()) {
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${css(lang)}</style></head><body>${fn(c, lang)}</body></html>`;
    const file = join(outDir, `_page-${lang}-${i + 1}.html`); writeFileSync(file, html);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
    await p.goto(`file://${resolve(file)}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
    const over = await p.evaluate(() => { const els = [...document.querySelectorAll(".wrap, .foot")]; return { wrapBottom: Math.round(document.querySelector(".wrap")?.getBoundingClientRect().bottom ?? 0), footTop: Math.round(document.querySelector(".foot")?.getBoundingClientRect().top ?? 0) }; });
    console.log(lang, i + 1, JSON.stringify(over));
    await p.screenshot({ path: join(outDir, `ThaiPass-eVOA-infographic-${lang.toUpperCase()}-${i + 1}.png`) });
    await ctx.close();
  }
}
await browser.close();
