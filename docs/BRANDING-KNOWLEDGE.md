# Knowledge: ชื่อแอป โลโก้ ไอคอนแท็บ และการติดตั้งเป็นแอป (PWA) ที่แอดมินตั้งได้ (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `src/lib/brand/{brand.ts,server.ts,serve.ts}` · `src/app/actions/brand.ts` · `src/app/(app)/admin/branding/*`
> · `src/app/brand/{logo,favicon}/route.ts` · `src/components/Logo.tsx` · `src/app/layout.tsx` (metadata) · `src/app/manifest.ts`
> · `src/lib/i18n/server.ts` (`brandedDict`, `getT`) · `src/lib/ai/server.ts` / `src/lib/notify/server.ts` / `src/lib/share/*` (ใช้ชื่อในข้อความที่ออกนอกแอป)
> · `supabase/migrations/20261120000100_branding.sql` · `public/sw.js`, `src/components/PwaRegister.tsx`

---

## 1. ปัญหาที่แก้

เจ้าของต้องการเปลี่ยนชื่อแอป (ไทย/อังกฤษ) โลโก้ และไอคอนแท็บ/ไอคอนบนหน้าจอโทรศัพท์ได้เอง **โดยไม่ต้อง deploy**
และชื่อใหม่ต้องไปถึง **ทุกที่** ที่ชื่อปรากฏ: หน้าเว็บ ชื่อแท็บ ไอคอนติดตั้ง ข้อความ LINE คำตอบของ AI การ์ดแชร์

## 2. สรุปสั้น

1. **ค่าทั้งหมดอยู่ใน JSON ก้อนเดียว** `platform_settings.brand` — เก็บเฉพาะสิ่งที่ต่างจากค่าเริ่มต้น; `{}` = ชื่อและรูปของระบบเอง
2. **ข้อความในแอปเขียนด้วยชื่อเริ่มต้นเสมอ** (ในพจนานุกรม) แล้ว **สลับชื่อทีเดียวตอนอ่าน** (`applyBrandNames` / `brandText`) — ไม่มีที่ไหนเก็บชื่อใหม่ซ้ำ
3. **รูปอยู่ใน bucket ส่วนตัว** แต่เสิร์ฟสาธารณะผ่าน route ของเรา `/brand/logo`, `/brand/favicon` (หน้าเข้าสู่ระบบต้องเห็นโลโก้)
   ไม่มีรูปของแอดมิน = redirect ไปรูปในตัว
4. **version = เวลาที่อัปโหลด** ใช้เป็น ETag และใส่ใน URL (`?v=`) — อัปรูปใหม่แล้วเบราว์เซอร์เห็นเร็ว ไม่ต้องอ่าน storage ทุกหน้า
5. **ไอคอนแท็บต้องเป็น PNG สี่เหลี่ยมจัตุรัส 192–1024 px** เพราะใช้เป็นไอคอนติดตั้งบนมือถือด้วย
6. settings cache ต่อ server instance 30 วินาที → การเปลี่ยนแปลงเห็นภายในประมาณหนึ่งนาที (บอกไว้บนหน้าจอ)

## 3. โครงที่ใช้

### 3.1 ข้อมูล

```jsonc
// platform_settings.brand
{
  "name_th": "…",
  "name_en": "…",
  "logo": { "mime": "image/png", "version": 1761234567890 },
  "favicon": { "mime": "image/png", "version": 1761234567999 },
}
```

- `parseBrand(raw)` **ใจกว้าง**: ช่องไหนหาย/ผิดรูป = ใช้ค่าเริ่มต้น (แถวเสียต้องไม่ทำให้ทุกหน้าพัง)
- `brandToColumn(b)` เขียนเฉพาะที่ต่างจากค่าเริ่มต้น
- `validBrandName`: 1–40 ตัวอักษร บรรทัดเดียว ห้าม `<` `>` และอักขระควบคุม (ชื่อไปอยู่ใน `<title>`, manifest, ข้อความ LINE)
- รูปเก็บใน bucket ส่วนตัว `brand-assets` ที่ path `<kind>-<version>.<ext>`

### 3.2 บันทึกรูป (`saveBrandImage`)

1. ตรวจขนาด (โลโก้ ≤ 1 MB, ไอคอน ≤ 512 KB) และชนิดจากไบต์จริง; ไอคอน: `checkFavicon` อ่านขนาดจาก header PNG (`pngSize`) → ต้องเป็น PNG, สี่เหลี่ยมจัตุรัส, 192–1024 px
2. อัปโหลดไฟล์ใหม่ (path มี version ใหม่, ไม่ upsert)
3. เขียน settings ให้ชี้ไฟล์ใหม่ — **ถ้าเขียนไม่สำเร็จ ลบไฟล์ใหม่ทิ้ง** (ยังใช้รูปเดิม)
4. สำเร็จแล้วจึงลบไฟล์เก่า → ไม่มีช่วงที่ "ไม่มีรูป"
5. ล้าง settings cache + `audit()`; "กลับไปใช้รูปเดิมของระบบ" = ลบ ref + ลบไฟล์

### 3.3 เสิร์ฟรูป (`serveBrandImage`)

```
GET /brand/logo
  ไม่มีรูปของแอดมิน → 307 ไปรูปในตัว (Cache-Control: public, max-age=60)
  If-None-Match ตรง ETag "logo-<version>" → 304
  อื่น ๆ → bytes + Content-Type + ETag + "public, max-age=60, must-revalidate"
          + X-Content-Type-Options: nosniff + Content-Security-Policy: default-src 'none'; sandbox
```

CSP `sandbox` กันกรณีไฟล์ที่อัปโหลดถูกเปิดตรง ๆ แล้วมีสคริปต์ (เช่น SVG) — และระบบไม่รับ SVG อยู่แล้ว

### 3.4 ชื่อไปถึงทุกที่

| ที่                                     | ทำอย่างไร                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ข้อความทุกหน้า                          | `getT()` / `brandedDict(lang)` = พจนานุกรมที่สลับชื่อแล้ว (ห้ามเขียนชื่อแอปนอก `dict.ts`)              |
| ชื่อแท็บ / iOS / Android                | `generateMetadata` ใน root layout: `title`, `applicationName`, `appleWebApp.title`, `icons` (มี `?v=`) |
| ไอคอนติดตั้ง (PWA)                      | `manifest.ts` (dynamic): `name`, `short_name`, ไอคอนของแอดมิน 192/512 ถ้ามี ไม่งั้นชุดในตัว + maskable |
| โลโก้ในแอป                              | `<LogoMark>` ชี้ `/brand/logo` เสมอ (ไม่ต้องรู้ว่าแอดมินตั้งหรือยัง)                                   |
| ข้อความ AI                              | `brandText(system, brand)` ก่อนส่ง (ไม่งั้น AI แนะนำตัวด้วยชื่อเก่า)                                   |
| ข้อความ LINE / แจ้งเตือน / การ์ดแชร์ OG | ใช้ชื่อ/โลโก้จาก `loadBrand()`                                                                         |

`applyBrandNames` สลับ **ครั้งเดียวด้วย regex เดียว** ที่จับทั้งชื่อไทยและอังกฤษ — ถ้าสลับทีละชื่อ ชื่อใหม่ที่มีชื่อเดิมอยู่ข้างใน
(เช่น "มียา รู้สุข" มี "รู้สุข") จะถูกสลับซ้ำเป็น "มียา มียา รู้สุข"

### 3.5 PWA (ติดตั้งเป็นแอป)

- `manifest.ts`: `start_url`/`id` = หน้าแรกของลูกค้า, `display: standalone`, `theme_color`/`background_color` ตามแบรนด์, shortcuts
- `public/sw.js` **แคชเฉพาะ `/offline.html` กับไอคอนหนึ่งรูป** — ห้ามแคชหน้าที่มีข้อมูลของคนที่ล็อกอิน (เครื่องใช้ร่วมกัน/ออกจากระบบแล้วยังเห็นได้)
- มีเมนู "ติดตั้งเป็นแอปบนเครื่อง" อธิบายวิธีของ iPhone (Share → Add to Home Screen) และ Android

## 4. กฎที่ห้ามละเมิด

1. ห้าม hard-code ชื่อแอปในข้อความ UI นอกพจนานุกรม และห้ามใช้ `<img src="/logo.png">` ตรง ๆ — ใช้ `LogoMark` / `/brand/logo`
2. ข้อความที่ออกนอกแอป (AI, LINE, การ์ดแชร์) ต้องผ่าน `brandText` / `loadBrand`
3. ห้ามรับ SVG/HTML เป็นรูปแบรนด์; ตรวจชนิดจากไบต์ ไม่ใช่นามสกุล
4. เปลี่ยนรูป = ไฟล์ใหม่ + version ใหม่ (ห้ามเขียนทับไฟล์เดิม — cache ของเบราว์เซอร์/CDN จะค้าง)
5. service worker ห้ามแคชข้อมูลส่วนตัว

## 5. บทเรียนจากของจริง

| เกิดอะไร                                   | สาเหตุราก                                | แก้อย่างไร                                                 |
| ------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| เปลี่ยนชื่อแล้ว AI ยังแนะนำตัวด้วยชื่อเดิม | system prompt เขียนชื่อตายตัว            | `brandText` ก่อนส่งทุกครั้ง                                |
| การ์ดแชร์ (OG) ยังเป็นโลโก้เดิม            | การ์ดวาดจากไฟล์ในตัว                     | การ์ดอ่านโลโก้ของแอดมิน                                    |
| ไอคอนบนหน้าจอมือถือเบลอ/ถูกตัด             | ยอมรับไฟล์ไม่จัตุรัส/เล็กเกิน            | บังคับ PNG จัตุรัส 192–1024 px                             |
| เทส manifest พังหลังแอดมินตั้งไอคอนเอง     | เทสคาดหวังไอคอน maskable ของชุดในตัวเสมอ | เทสตรวจ maskable เฉพาะเมื่อไม่มีไอคอนของแอดมิน             |
| เปลี่ยนรูปแล้วบางคนยังเห็นรูปเก่านาน       | cache ยาว + URL เดิม                     | ETag ตาม version + max-age 60 + `?v=` ใน metadata/manifest |

## 6. ลอกไปใช้อย่างไร

1. คอลัมน์ JSON ใน settings + `parseBrand` / `brandToColumn` / `validBrandName`
2. bucket ส่วนตัว + `saveBrandImage` (อัปใหม่ → ชี้ → ลบเก่า) + route เสิร์ฟพร้อม ETag/fallback
3. พจนานุกรมที่เขียนด้วยชื่อเริ่มต้น + `applyBrandNames` แบบ regex เดียว + `getT()` ที่คืนพจนานุกรมสลับแล้ว
4. metadata + manifest แบบ dynamic อ่านจาก brand
5. ส่งชื่อผ่าน `brandText` ในทุกช่องทางที่ออกนอกแอป
6. หน้าแอดมิน `/admin/branding` + audit + บอกว่ามีผลภายในประมาณหนึ่งนาที
7. เทส: `applyBrandNames` (ชื่อใหม่ที่มีชื่อเก่าข้างใน), `validBrandName`, `checkFavicon` (ไม่ใช่ PNG / ไม่จัตุรัส / เล็ก / ใหญ่), `parseBrand` กับข้อมูลเสีย, route คืน 304 / redirect
