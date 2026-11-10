# ส่งต่องาน ThaiPass e-VOA (อัปเดต 10 พ.ย. 2026)

เอกสารนี้ให้ Claude ใน session/account ใหม่อ่านก่อนทำงานต่อ **ไม่มีความลับในไฟล์นี้** (ไม่มีคีย์ โทเค็น หรือรหัสผ่าน)
อ่านต่อด้วย: `CLAUDE.md` (กติกาของเจ้าของ, บังคับทุกครั้ง) → `docs/evoa/ROADMAP.md` (สถานะละเอียด) → `docs/evoa/09-SUMMARY.md` (ภาพรวมทุก Phase) → `docs/evoa/12-PIVOT-ANALYSIS.md` (ทิศทางใหม่)

## 1. ผู้ใช้และวิธีทำงาน
- เจ้าของพูดไทย **ตอบเป็นภาษาไทยเสมอ** และ **ทุกคำตอบต้องจบด้วย "Next steps"** (รายการเลขข้อของสิ่งที่ค้างในเฟสปัจจุบันและเฟสถัดไป) พร้อมอัปเดต `docs/evoa/ROADMAP.md` ในการเปลี่ยนแปลงเดียวกัน และ **ห้ามเริ่มข้อใน Next steps จนกว่าเจ้าของเลือก**
- ผลงานที่บอกว่า "เสร็จ" ต้องตรวจจริง: typecheck, `npm test`, `npm run build`, และดูหน้าจอจริงที่ 390×844 กับ 1280×800 สำหรับงาน UI
- รายงานตรงตามจริงเมื่อมีสิ่งที่ยังไม่ได้ทดสอบ (เช่น มือถือจริง, WhatsApp จริง, Open-Meteo แบบเสียเงิน)

## 2. ระบบคืออะไร
ThaiPass e-VOA: เว็บยื่น Visa on Arrival ออนไลน์ + ชุดเครื่องมือนักท่องเที่ยว (ความปลอดภัย เอกสารออฟไลน์ เช็กอินครอบครัว ฯลฯ)
Next.js 16 (App Router) + Supabase (Auth, Postgres, Storage, Realtime) + Vercel ที่ https://e-voa.vercel.app · repo `geeravut-lab/e-voa`
ตลาด VOA เดิมแทบหมดแล้วตั้งแต่ 15 ก.ย. 2026 (ดู `12-PIVOT-ANALYSIS.md`) **รอเจ้าของเลือกทิศทาง A / B / C**

## 3. Git และการ deploy
- branch พัฒนา: `claude/stoic-sagan-evczok` (push ขึ้น `origin` ด้วย) แล้ว **push `HEAD:main` ทุกครั้งที่ต้องการ deploy production** (main → Vercel อัตโนมัติ)
- ก่อน push: `git fetch origin main && git merge origin/main`
- ตรวจผลหลัง push: สถานะ commit (Vercel) และ GitHub Actions workflow `CI` (`.github/workflows/ci.yml`: typecheck, test, build, lint:colors, accessibility) ต้องผ่านทั้งหมด
- ห้ามสร้าง PR เว้นแต่เจ้าของสั่ง
- ลงท้ายข้อความ commit ตามที่ระบบ session กำหนด (บรรทัด Co-Authored-By และ Claude-Session)

## 4. คำสั่งสำคัญ
```bash
npm run typecheck   # tsc
npm test            # vitest (433 ข้อ, ทดสอบตรรกะล้วน ไม่แตะฐานข้อมูลจริง)
npm run build       # ต้องสร้าง build ใหม่ก่อนรันชุด live ที่เปิดเว็บ
npm run lint:colors # ห้ามมีสี hex นอก globals.css (ยกเว้นไฟล์ที่อยู่ใน allowlist ของ scripts/check-no-hex.mjs)
npm run mock        # ตัวจำลองพาร์ตเนอร์/สตม. ที่พอร์ต 4010
npm run e2e:phase1  # ชุด live (vitest.live.config.ts) กับ Supabase จริง + ตัวจำลอง
```
- ชุด live อยู่ใน `tests-live/` ใช้ผู้ใช้ทดสอบชั่วคราว ลบเองเมื่อจบ ต้องมีตัวแปร `SB_URL`, `SB_ANON`, `SB_SERVICE` ในสภาพแวดล้อมของโปรเซส
- ชุดเต็มใช้เวลานาน (ราว 1 ชม. ขึ้นไป) รันเบื้องหลังแล้วรอผลด้วย monitor
- **ก่อนรันชุดที่เปิดเว็บ ให้ kill โปรเซส `next-server` ที่ค้างอยู่ก่อน** (เคยทำให้เทสต์ล้มเท็จ)
- เทสต์เบราว์เซอร์ "wizard ... Find" เคยล้มแบบสุ่มเมื่อเครื่องโหลดหนัก (ฟอร์มกรอกก่อน hydrate) รันซ้ำผ่านได้
- สคริปต์ช่วยในโฟลเดอร์ scratchpad ของ session เก่า (`withenv.sh`, `applysql.mjs`) **ไม่อยู่ใน repo**: `withenv.sh` ดึงคีย์ Supabase ผ่าน Management API ด้วยโทเค็นที่ฉีดโดย environment เข้ามาเป็นตัวแปรของโปรเซสลูกชั่วคราว ไม่พิมพ์และไม่เก็บที่ใด ถ้าต้องใช้ ให้เขียนใหม่ในรูปแบบเดียวกัน **ห้ามพิมพ์หรือเขียนคีย์ลงไฟล์**

## 5. กติกาที่ห้ามพลาด (สรุปจาก CLAUDE.md และที่เจ้าของสั่งเพิ่ม)
1. ห้ามเปิดเผยความลับ: `SUPABASE_SERVICE_ROLE_KEY` และคีย์ฝั่งเซิร์ฟเวอร์ไม่มี `NEXT_PUBLIC_` ใช้เฉพาะโค้ดฝั่งเซิร์ฟเวอร์ ห้ามเขียนลงไฟล์/เอกสาร/commit
2. ปุ่ม เมนู ลิงก์ที่ทำงานช้าต้องมี spinner: ใช้ `SubmitButton`, `AsyncButton`, `AppLink`, `NavRowLink`
3. ข้อความ UI ผ่านพจนานุกรม `src/lib/i18n/dict/*` (EN, TH, ZH-CN ครบ; ภาษาอื่นตกกลับอังกฤษ; ตอนนี้ฝั่งนักท่องเที่ยวแปลครบ 9 ภาษาแล้ว) เซิร์ฟเวอร์คืนรหัส `err_*`
4. เมนูมาจาก `src/config/nav.ts` แหล่งเดียว
5. หน้าแอดมินเรียก `requireAdminPage(cap)` และ action เรียก `requireAdminAction(cap)` บรรทัดแรก
6. เขียนฐานข้อมูลที่ไม่ตรงแถวไม่ถือว่าสำเร็จ (ใช้ `.select("id")` นับแถว)
7. ห้ามบันทึกว่าผ่านสิ่งที่ยังไม่ได้ตรวจ (การชำระเงิน เอกสาร การอนุมัติ)
8. ค่าตั้งค่าอ่านไม่ได้ให้ใช้ค่าเริ่มต้นในโค้ดและทำงานต่อ (fail open)
9. ชื่อแบรนด์/โลโก้/favicon มาจาก `/brand/*` และ `getT().brandName` ห้ามฝังในคอมโพเนนต์
10. ห้ามคัดลอกคีย์จากเอกสารเก่า (`TieThai & WeGoThiland Documents/`) มาใส่โค้ดหรือเอกสาร
11. งานที่เกี่ยวกับ Immigration/ประกัน/SIM/VIP/Beauty & Health ต้องทดสอบกับตัวจำลองใน `tools/mock-partners` ก่อน
12. **ห้ามเปลี่ยน `DATA_ENCRYPTION_KEY`** (ข้อมูลเข้ารหัสเก่าจะอ่านไม่ได้)
13. ห้ามแตะแถว `content_items` จริงของเจ้าของ (ข่าว/บทความ/FAQ ที่เจ้าของเขียน) ในการทดสอบ ถ้าสคริปต์สร้างข่าวทดสอบต้องลบเอง
14. ห้ามใช้ `curl -k` หรือปิดการตรวจ TLS
15. ห้ามคัดลอกคีย์จาก environment ออกมาแสดงหรือเก็บไว้ ผู้ช่วยไม่ควรอ่านสคริปต์ที่ดึงคีย์ ถ้าระบบความปลอดภัยปฏิเสธคำสั่งที่เกี่ยวกับคีย์ ให้หยุดแล้วถามเจ้าของ

## 6. การเขียนฐานข้อมูลจริง
- ไฟล์ migration อยู่ที่ `supabase/migrations/` (ล่าสุด `20261127000100_family_checkin.sql` รันแล้วทั้งหมด)
- การรัน migration ผ่าน Supabase Management API (`https://api.supabase.com/v1/projects/<ref>/…`) **ต้องได้รับอนุญาตจากเจ้าของทุกครั้ง** (รอบก่อน ๆ เจ้าของเคยตอบ "อนุญาตให้รันด้วย Management API ได้เลย" เป็นรายครั้ง) migration ใหม่ให้เป็นแบบเพิ่มเท่านั้น (additive) ถ้าระบบความปลอดภัยปฏิเสธ ให้หยุดและถามเจ้าของ อย่าหาทางอ้อม
- การลบข้อมูลจำนวนมากบน production **ต้องได้รับคำสั่งชัดเจน** ทดสอบลบเฉพาะสิ่งที่ทดสอบสร้างเองในรอบเดียวกัน

## 7. ของค้างที่ **ห้ามทำเอง** จนกว่าเจ้าของสั่ง
- ลบข้อมูลทดสอบเก่าบน production: ผู้ใช้ทดสอบ 17 คน (อีเมลรูปแบบ `p1-`, `p2-`, `p2b-` ลงท้าย `@example.com`), แถว `partner_packages` ที่มาจากตัวจำลอง 7 แถว, และแอดมินทดสอบ `p2b-…` / `p2-ai-boss-…`
- ฐานข้อมูลจริงมีรายการอ้างอิงตัวอย่าง (ป้าย `sample`) เพื่อลอง wizard: **อย่ารับใบสมัครจริง** จนกว่าจะซิงก์จาก สตม. ครั้งแรก

## 8. สถานะ ณ วันนี้
- โค้ดล่าสุดบน `main` คือ commit `62ebbb4` (CI และ Vercel ผ่าน) ชุดทดสอบ live รอบเต็มล่าสุดผ่าน 137/137 (ก่อนงานลิงก์ LINE/โทรศัพท์ซึ่งมีเทสต์ unit ของมันเอง)
- unit test: 433 ข้อผ่าน
- **ทำเสร็จในช่วงล่าสุด:** เช็กอินครอบครัว "ฉันปลอดภัย", ตรวจ accessibility หน้าที่ต้องล็อกอิน (แก้แล้ว), แปลชุดเครื่องมือ/เช็กอินครอบครัว/ข้อความคิวใบสมัครเป็น HI AR RU KO JA ZH-TW, ข่าวแบบ rich text + รูปภาพ, อินโฟกราฟิก EN/TH 3 หน้า + แผ่น "ETA vs TDAC" (ไทย), แถบเลือกหลายรายการในคิวแบบกะทัดรัด, การ์ดข่าวหน้าแรกตัด 3 บรรทัด, ลิงก์ LINE/โทรศัพท์ในหน้า "ช่องทางทางการ", รายงานวิเคราะห์ทิศทางใหม่
- **การตัดสินใจของเจ้าของ:** หน้าแรกแสดงข่าวปักหมุดล่าสุดข่าวเดียว (Q13 ใน ROADMAP)

## 9. ของค้างและทิศทางต่อไป (ให้เจ้าของเลือก)
**รอการตัดสินใจ**
1. ทิศทางธุรกิจจาก `12-PIVOT-ANALYSIS.md`: A (Thailand Stay OS), C (ผู้ช่วยวีซ่าขาออกของคนไทย), B (Migrant Workforce Compliance Cloud) หรือผสมกัน
2. ลบข้อมูลทดสอบเก่า (ข้อ 7)

**งานที่ทำได้ทันที (ถ้าเจ้าของเลือก)**
- ตัวช่วยฟรีในแอป "TDAC / ETA / e-Visa ต่างกันอย่างไร" (ETA ของไทยยังไม่ยืนยัน อย่าเขียนว่าบังคับใช้แล้ว)
- WhatsApp: template ตามภาษาโปรไฟล์ + หัวรูปแถบสี + ปุ่มเปิดดู (ต้องมีบัญชี WhatsApp Business จริงเพื่อทดสอบ) ตอนนี้ส่ง template เดียวภาษาเดียว (`WHATSAPP_TEMPLATE_LANG`)
- แปลข้อความหลังบ้านที่เหลือราว 590 ข้อความเป็น 6 ภาษา
- ทดสอบด้วย screen reader จริง

**ฝั่งเจ้าของ (ไม่ใช่งานของ Claude)**
- ใส่ `OPEN_METEO_API_KEY` (แผนเสียเงิน: API ฟรีโดนจำกัด 429), ตั้ง Resend + โดเมนผู้ส่ง, ลองจ่ายผ่าน Stripe จริง 1 ครั้งและลงทะเบียน webhook
- ทดสอบตู้เอกสารออฟไลน์ Web Push เช็กอินครอบครัว และการบันทึก PNG บนมือถือจริง
- ให้ผู้เชี่ยวชาญตรวจเนื้อหาความปลอดภัย/บัตรสุขภาพ/คำแปล 6 ภาษา และถ้อยคำ PDPA และตรวจกฎ VOA หลัง 15 ก.ย. 2026 กับ สตม.
- ขอสเปกและ credential API จริงจาก สตม. และพาร์ตเนอร์ (ยังใช้ตัวจำลอง)
- ยืนยันสถานะอินเดีย (VOA หรือ visa-free 30 วัน) กับกระทรวงการต่างประเทศ

## 10. การตั้งค่าที่เกี่ยวกับ account (ถ้าย้ายไป account Claude อื่น)
ประวัติแชตไม่ย้ายตาม ต้องตั้งค่าใหม่ในฝั่ง Claude:
1. เชื่อม GitHub ที่ https://claude.ai/connect-github (บัญชี GitHub ที่เข้า `geeravut-lab/e-voa` ได้) และติดตั้ง Claude GitHub App ที่ repo
2. สร้าง cloud environment: เลือก repo `geeravut-lab/e-voa`, network แบบจำกัด อนุญาตโฮสต์ `ytzktizvmeayugdfzzlk.supabase.co`, `api.supabase.com`, `api.stripe.com`, `air4thai.pcd.go.th`, `www.tmd.go.th`, `data.tmd.go.th`, `api.open-meteo.com`, `air-quality-api.open-meteo.com`, เปิด package registry, ไม่มี setup script
3. ใส่ secret ในหน้าตั้งค่า environment (ช่อง Network secrets) เอง: Supabase Personal Access Token สำหรับ `api.supabase.com` และ Stripe TEST secret key สำหรับ `api.stripe.com` **ห้ามวางค่าในแชต**
4. ค่าฝั่ง production (คีย์ของระบบ, `CRON_SECRET`, `SITE_URL`, VAPID, Resend, LINE/Wallet) อยู่ที่ Vercel และ GitHub Actions secrets ของ repo อยู่แล้ว ไม่ต้องย้าย
5. GitHub Actions `Weather warning alerts` (`.github/workflows/warnings.yml`) เรียก job `warnings,safety` ทุก 30 นาที ใช้ secrets `SITE_URL` และ `CRON_SECRET` ของ repo (ตั้งแล้ว)
6. ถ้า account เก่ายังมี session ที่ push เข้า `main` ให้หยุดก่อน เพื่อไม่ให้สองฝั่งแก้ทับกัน

## 11. จุดที่โค้ดพึ่งพากันและควรรู้
- ชุดเครื่องมือนักท่องเที่ยว: เนื้อหาในโค้ดที่ `src/lib/content/*` กับคำแปล 6 ภาษาใน `src/lib/content/lang/<code>-a.ts` และ `-b.ts` มีเทสต์ `lang.test.ts` กันของขาด เนื้อหาที่เจ้าของแก้ผ่าน `/admin/toolkit` เก็บในการตั้งค่า `toolkit_content` (ฟอร์มแก้ได้ 3 ภาษา รายการที่ไม่ถูกแก้จะคงคำแปล 6 ภาษา)
- แจ้งเตือน: `src/lib/notify.ts` → ในแอป + อีเมล + LINE (การ์ด Flex ตามภาษาโปรไฟล์) + WhatsApp (template) + Web Push; งานตามเวลาอยู่ที่ `src/lib/jobs.ts` (`/api/cron/tick?only=...`)
- ข่าว: `content_items` kind `news` เก็บข้อความ Markdown แบบย่อ (`src/lib/content/rich.ts`) รูปเก็บใน bucket `brand-assets` โฟลเดอร์ `news/` เสิร์ฟที่ `/news-img/<ชื่อสุ่ม>`
- อินโฟกราฟิก: ตัวสร้างอยู่ที่ `tools/infographic/` (`art.tsx` → JSON ภาพประกอบ, `build.mjs` 3 หน้า EN/TH, `eta-tdac.mjs` แผ่นเดียว) ไฟล์ PNG อยู่ที่ `docs/evoa/infographic/`
- ข้อควรระวัง CSS: ห้ามใส่คลาส `block` คู่กับ `line-clamp-*` (ทับ `display` ของ clamp ทำให้ไม่ตัดบรรทัด)
