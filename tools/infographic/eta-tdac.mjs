// One-page infographic (Thai): "How are ETA and TDAC different?" — a question and its answer.
//   node tools/infographic/eta-tdac.mjs <out.png> [<fonts-dir>]     (run from the repo root; Playwright is the pre-installed one)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const [out, fontsArg] = process.argv.slice(2);
const FONTS = resolve(fontsArg ?? "node_modules"), W = 1414, H = 2000;
const logo = `file://${resolve("public/icons/logo-mark.svg")}`;
const css = `
${["plus-jakarta-sans", "noto-sans-thai"].map((p) => `@import url("file://${FONTS}/node_modules/@fontsource-variable/${p}/index.css");`).join("\n").replace(/\/node_modules\/node_modules/g, "/node_modules")}
:root{--blue:#1557E0;--teal:#0FB5AE;--teald:#0A7C78;--gold:#FFB627;--goldd:#8A5A00;--lotus:#FF4F8B;--sky:#E8F1FF;--mint:#DDF7F5;--sand:#FFF8EC;--ink:#0B2545;--muted:#4A5B73;--line:#DCE6F5;--danger:#C2261C}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:"Plus Jakarta Sans Variable","Noto Sans Thai Variable",sans-serif;background:#FBFAF6;color:var(--ink);position:relative}
.hero{position:relative;color:#fff;background:linear-gradient(120deg,#1557E0 0%,#1288D6 52%,#0FB5AE 100%);height:366px;padding:40px 94px 0;overflow:hidden}
.hero::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-130px;height:210px;background:#FBFAF6;border-radius:50%/100% 100% 0 0}
.brand{display:flex;align-items:center;gap:16px}.brand .logo{width:64px;height:64px;border-radius:18px;background:#fff;display:grid;place-items:center}.brand .logo img{width:46px;height:46px}.brand b{font-size:28px;font-weight:800}
.q{display:inline-flex;align-items:center;gap:14px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.55);border-radius:999px;padding:8px 22px;font-size:22px;font-weight:800;margin-top:30px}
h1{margin-top:22px;font-size:58px;line-height:1.15;font-weight:800;max-width:1100px}h1 span{color:#FFE9B0}
.wrap{padding:0 94px}
.sec{display:flex;align-items:center;gap:18px;margin:0 0 12px}.sec .num{flex:none;width:54px;height:54px;border-radius:50%;background:var(--teald);color:#fff;font-weight:800;font-size:26px;display:grid;place-items:center}.sec h2{font-size:32px;font-weight:800;color:var(--teald);white-space:nowrap}.sec i{flex:1;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--teal),rgba(15,181,174,0))}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.big{border-radius:28px;padding:24px 28px;border:2px solid var(--line);background:#fff;box-shadow:0 6px 18px -10px rgba(11,37,69,.25)}
.big .tag{display:inline-block;font-size:44px;font-weight:800;letter-spacing:-1px}
.big .sub{font-size:20px;color:var(--muted);font-weight:600;margin-top:2px}
.big .verb{display:inline-flex;align-items:center;gap:10px;margin-top:14px;border-radius:999px;padding:8px 20px;font-size:26px;font-weight:800}
.big p{font-size:21px;margin-top:12px;font-weight:500;line-height:1.45}
.tdac{border-color:#B9E8E4;background:linear-gradient(160deg,#fff,var(--mint))}.tdac .tag{color:var(--teald)}.tdac .verb{background:var(--teald);color:#fff}
.eta{border-color:#F3D69A;background:linear-gradient(160deg,#fff,var(--sand))}.eta .tag{color:var(--goldd)}.eta .verb{background:var(--gold);color:#3b2600}
table{width:100%;border-collapse:separate;border-spacing:0;border:2px solid var(--line);border-radius:24px;overflow:hidden;background:#fff;font-size:20px}
th,td{padding:9px 18px;text-align:left;vertical-align:top;border-bottom:1.5px solid var(--line)}tr:last-child td{border-bottom:0}
th{font-size:21px;font-weight:800;color:#fff}th.a{background:var(--teald)}th.b{background:#B7790A}th.k{background:var(--ink)}
td.k{font-weight:800;color:var(--ink);background:var(--sky);width:21%}td{font-weight:500;line-height:1.4}
.ok{color:#0E7A4F;font-weight:800}.warn{color:#B7790A;font-weight:800}
.flow{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:#fff;border:2px solid var(--line);border-radius:24px;padding:18px 22px;box-shadow:0 6px 18px -10px rgba(11,37,69,.25)}
.card h3{font-size:24px;font-weight:800;margin-bottom:10px}
.step{display:flex;gap:12px;align-items:flex-start;font-size:20px;font-weight:500;line-height:1.4;margin-bottom:8px}.step b.n{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:18px;color:#fff;background:var(--blue)}
.note{display:flex;gap:18px;align-items:flex-start;background:#FFF1CC;border:2px solid #F3D69A;border-radius:24px;padding:18px 24px}
.note .ic{flex:none;width:54px;height:54px;border-radius:50%;background:#fff;color:var(--goldd);display:grid;place-items:center;font-size:30px;font-weight:800}
.note h3{font-size:24px;font-weight:800;color:var(--goldd);margin-bottom:4px}.note p{font-size:20px;font-weight:500;line-height:1.45;color:#5a3d00}
.foot{position:absolute;left:0;right:0;bottom:0;padding:44px 94px 16px;background:linear-gradient(120deg,#1557E0,#0FB5AE);color:#fff}
.foot::before{content:"";position:absolute;left:-10%;right:-10%;top:-52px;height:104px;background:#FBFAF6;border-radius:0 0 50% 50%/0 0 100% 100%}
.foot *{position:relative}
`;
const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="hero">
  <div class="brand"><div class="logo"><img src="${logo}"></div><b>ThaiPass e-VOA</b></div>
    <h1>ETA กับ TDAC ต่างกันอย่างไร?<br><span>TDAC = แจ้งข้อมูล · ETA = ขออนุญาต</span></h1>
</div>
<div class="wrap" style="margin-top:-6px;position:relative">
  <div class="sec"><span class="num">1</span><h2>คำตอบสั้น ๆ</h2><i></i></div>
  <div class="two" style="margin-bottom:20px">
    <div class="big tdac"><span class="tag">TDAC</span><div class="sub">Thailand Digital Arrival Card</div><span class="verb">📝 แจ้งข้อมูลล่วงหน้า</span>
      <p>บัตรขาเข้าแบบดิจิทัล แทนบัตร ตม.6 กระดาษ ให้ ตม. รู้ข้อมูลเที่ยวบิน ที่พัก และประเทศที่มา <b>ไม่ใช่การอนุมัติ</b></p></div>
    <div class="big eta"><span class="tag">ETA</span><div class="sub">Electronic Travel Authorization</div><span class="verb">✅ ขออนุญาตก่อนขึ้นเครื่อง</span>
      <p>ไม่ใช่วีซ่า แต่เป็นการให้ประเทศปลายทางคัดกรองล่วงหน้าสำหรับคนที่ไม่ต้องขอวีซ่า <b>อนุมัติหรือปฏิเสธได้</b> (ตามแนวคิด ETA ในต่างประเทศ)</p></div>
  </div>

  <div class="sec"><span class="num">2</span><h2>เปรียบเทียบทีละข้อ</h2><i></i></div>
  <table style="margin-bottom:20px">
    <tr><th class="k"></th><th class="a">TDAC</th><th class="b">ETA (ตามแผนของไทย)</th></tr>
    <tr><td class="k">ผลลัพธ์</td><td>ได้หลักฐานการกรอกข้อมูล</td><td>อนุมัติหรือปฏิเสธการเดินทาง</td></tr>
    <tr><td class="k">ใครต้องทำ</td><td>ชาวต่างชาติ <b>ทุกคน</b> ที่เข้าไทย</td><td>เฉพาะสัญชาติที่ <b>ได้ยกเว้นวีซ่า</b></td></tr>
    <tr><td class="k">สถานะตอนนี้</td><td><span class="ok">ใช้งานจริงแล้ว</span> กรอกภายใน 3 วันก่อนถึง (นับวันถึงด้วย)</td><td><span class="warn">ยังไม่ชัดว่าบังคับใช้หรือยัง</span> แหล่งข้อมูลขัดกัน</td></tr>
    <tr><td class="k">ค่าธรรมเนียม</td><td><span class="ok">ฟรี</span></td><td>แหล่งส่วนใหญ่ระบุว่าฟรี แต่ยังไม่แน่นอน</td></tr>
    <tr><td class="k">เกี่ยวกับวีซ่า</td><td>แยกจากวีซ่า ต้องทำคู่กัน e-VOA ใช้แทนไม่ได้</td><td>ไม่ใช่วีซ่า ใช้กับคนที่ไม่ต้องขอวีซ่า</td></tr>
  </table>

  <div class="sec"><span class="num">3</span><h2>แล้วฉันต้องทำอะไรบ้าง?</h2><i></i></div>
  <div class="flow" style="margin-bottom:24px">
    <div class="card"><h3>🛂 ถ้า “ไม่ต้องขอวีซ่า” (visa-free)</h3>
      <div class="step"><b class="n">1</b><span>กรอก <b>TDAC</b> ภายใน 3 วันก่อนถึง</span></div>
      <div class="step"><b class="n">2</b><span>ติดตามประกาศ <b>ETA</b> ถ้าไทยบังคับใช้ในอนาคต</span></div>
      <div class="step"><b class="n">3</b><span>พักได้ 30 วัน (ตั้งแต่ 15 ก.ย. 2026) ต่อได้อีก 30 วัน</span></div></div>
    <div class="card"><h3>📄 ถ้า “ต้องมีวีซ่า” (e-Visa / VOA)</h3>
      <div class="step"><b class="n">1</b><span>ขอ <b>วีซ่า / e-Visa / VOA</b> ตามสัญชาติ</span></div>
      <div class="step"><b class="n">2</b><span>กรอก <b>TDAC</b> ภายใน 3 วันก่อนถึง</span></div>
      <div class="step"><b class="n">3</b><span>แสดงวีซ่าและหลักฐาน TDAC ที่ด่านตรวจคนเข้าเมือง</span></div></div>
  </div>

  <div class="sec"><span class="num">4</span><h2>จำง่าย ๆ ด้วยตัวอย่าง</h2><i></i></div>
  <div class="flow" style="margin-bottom:24px">
    <div class="card" style="background:var(--mint);border-color:#B9E8E4"><h3 style="color:var(--teald)">TDAC = ลงทะเบียนผู้เข้าอาคาร</h3><div style="font-size:20px;font-weight:500;line-height:1.45">เหมือนกรอกชื่อ เวลา และเหตุผลที่มา ที่ประตูอาคาร ทุกคนต้องกรอก แต่กรอกแล้ว<b>ไม่ได้แปลว่าผ่าน</b></div></div>
    <div class="card" style="background:var(--sand);border-color:#F3D69A"><h3 style="color:var(--goldd)">ETA = ขอบัตรผ่านก่อนมาถึงอาคาร</h3><div style="font-size:20px;font-weight:500;line-height:1.45">เหมือนขอบัตรผ่านล่วงหน้า ถ้าไม่ได้รับอนุมัติ <b>ก็เข้าไม่ได้</b> (เป็นแนวคิดของ ETA ทั่วไป ไทยยังไม่ยืนยันรายละเอียด)</div></div>
  </div>

  <div class="note"><span class="ic">!</span><div><h3>ข้อควรระวัง: อย่าจ่ายเงินให้เว็บที่อ้างว่ายื่นแทน</h3>
    <p>TDAC ของทางการ <b>ฟรี</b> เว็บที่เก็บเงินไม่ใช่เว็บทางการ พิมพ์ที่อยู่เว็บเอง ไม่กดลิงก์จากข้อความหรือโฆษณา ส่วน ETA ของไทยยังไม่มีประกาศที่ยืนยันได้ ให้ตรวจกับกระทรวงการต่างประเทศหรือสำนักงานตรวจคนเข้าเมืองก่อนเชื่อ</p></div></div>
</div>
<div class="foot">
  <div style="font-size:30px;font-weight:800">ThaiPass e-VOA · e-voa.vercel.app/tdac</div>
  <div style="font-size:16px;opacity:.92;margin-top:4px">ThaiPass e-VOA เป็นผู้ให้บริการเอกชน ไม่ใช่เว็บไซต์ของรัฐบาล ข้อมูลสรุปจากแหล่งสาธารณะ พ.ย. 2026 กฎอาจเปลี่ยน ตรวจสอบกับหน่วยงานทางการก่อนเดินทาง</div>
</div>
</body></html>`;
writeFileSync(out.replace(/\.png$/, ".html"), html);
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 }), p = await ctx.newPage();
await p.goto("file://" + resolve(out.replace(/\.png$/, ".html"))); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() => ({ wrapBottom: Math.round(document.querySelector(".wrap").getBoundingClientRect().bottom), footTop: Math.round(document.querySelector(".foot").getBoundingClientRect().top) }))));
await p.screenshot({ path: out }); await b.close();
