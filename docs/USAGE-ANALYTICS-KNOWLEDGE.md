# Knowledge: สถิติการใช้งาน — DAU/WAU/MAU, funnel, retention และการใช้ฟีเจอร์ (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `supabase/migrations/20261015000100_product_events.sql` (ตาราง + `admin_analytics()`)
> · `src/lib/analytics/{events.ts,server.ts}` · `src/app/(app)/admin/analytics/page.tsx` · `src/app/(app)/layout.tsx` (บันทึก `active`)
> แนวคิดตั้งต้น: `docs/05-usage-analytics.md` (จากโครงการก่อนหน้า) — ไฟล์นี้คือสิ่งที่ RooSuk ทำจริงบน Next.js + Supabase

---

## 1. ปัญหาที่แก้

เจ้าของต้องรู้ว่า "มีคนใช้จริงกี่คน ใช้อะไร หลุดตรงไหน กลับมาไหม" **โดยไม่ส่งข้อมูลสุขภาพไปให้บริการวิเคราะห์ภายนอก**
และไม่เก็บเนื้อหาที่ผู้ใช้กรอก (ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม PDPA)

## 2. สรุปสั้น

1. **ตารางเหตุการณ์เล็ก ๆ ของเราเอง** (`product_events`) — ไม่มี Google Analytics / pixel / SDK ภายนอก
2. **เหตุการณ์ไม่มีเนื้อหา**: ชื่อเหตุการณ์ + วัน (เวลาไทย) + user + แท็กสั้น ๆ (≤ 40 ตัว `[a-z0-9_]`) เท่านั้น — ไม่มีคำตอบ ค่าแล็บ อาหาร หรือข้อความ
3. **รายชื่อเหตุการณ์อยู่ในโค้ด** (`EVENTS`) — พิมพ์ผิดแล้วคอมไพล์ไม่ผ่าน ไม่สร้างเหตุการณ์ใหม่โดยไม่ตั้งใจ; ฐานข้อมูลตรวจแค่รูปร่างชื่อ
4. **`trackEvent()` ไม่เคย throw และไม่บล็อกงานของผู้ใช้** — เขียนพลาด = log แล้วลืม
5. **"active" วันละครั้งต่อคน** — unique index ในฐานข้อมูล + จำในหน่วยความจำของ server instance ว่าวันนี้บันทึกแล้ว (ไม่เขียนทุกหน้า)
6. **แดชบอร์ดทั้งหน้ามาจากฟังก์ชัน SQL ตัวเดียว** (`admin_analytics(days)`) — หนึ่ง round trip, ผลตรวจด้วย zod (ค่าผิดรูป = 0 ไม่พัง)
7. แถวของผู้ใช้ **ลบตามบัญชี** (`on delete cascade`) และอยู่ในสำเนาข้อมูลตาม PDPA

## 3. โครงที่ใช้

### 3.1 ตาราง

```sql
create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,   -- null = แบบทดสอบสาธารณะ (ยังไม่ล็อกอิน)
  event text not null check (event ~ '^[a-z][a-z0-9_]{2,39}$'),
  day date not null default public.bangkok_today(),            -- วันตามเวลาไทย
  detail text check (detail is null or length(detail) <= 40),
  created_at timestamptz not null default now()
);
create index product_events_day_event_idx on public.product_events (day, event);
create index product_events_user_idx on public.product_events (user_id, day) where user_id is not null;
-- ครั้งเดียวต่อคนต่อวัน / ครั้งเดียวต่อคน: ซ้ำ = ถูกปฏิเสธเงียบ ๆ
create unique index product_events_active_uniq on public.product_events (user_id, day) where event = 'active';
create unique index product_events_signup_uniq on public.product_events (user_id) where event = 'signup';
-- RLS เปิด, revoke ทั้งหมด: เขียน/อ่านด้วย service role เท่านั้น
```

### 3.2 เหตุการณ์ (ตัวอย่างจาก `EVENTS`)

| กลุ่ม           | เหตุการณ์                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| การมีชีวิตอยู่  | `active` (วันละครั้ง จาก layout ของหน้าที่ล็อกอิน), `signup` (ครั้งแรกที่ยอมรับ consent ครบ)                                                                                                                                  |
| funnel          | `quiz_completed` → `signup` → การสแกนครั้งแรก → `paywall_viewed` → `order_created` → `subscribed`                                                                                                                             |
| การใช้ฟีเจอร์   | `food_scanned`, `food_typed`, `lab_scanned`, `lab_explained`, `body_scanned`, `ask_sent`, `agent_used`, `checkin_done`, `report_generated`, `vault_uploaded`, `passport_created`, `goal_created`, `shop_order`, `shop_paid` … |
| แท็ก (`detail`) | เช่น `goal_program_made` = `ai` / `template`, `share_made` = `quiz` / `lab` / `food`                                                                                                                                          |

เพิ่มเหตุการณ์ = เพิ่มชื่อใน `EVENTS` + เรียก `trackEvent(name, userId, detail?)` **หลัง** งานสำเร็จ + คำแปลชื่อในพจนานุกรม

### 3.3 การบันทึก

```ts
export async function trackEvent(event: ProductEvent, userId: string | null, detail?: string) {
  if (event === "active" && userId) {           // หน้าแรกของวันเท่านั้นที่เขียนจริง
    const day = new Date().toISOString().slice(0, 10);
    const map = ((globalThis as any).__rooActive ??= new Map<string, string>());
    if (map.get(userId) === day) return;
    if (map.size > 5000) map.clear();
    map.set(userId, day);
  }
  try {
    const { error } = await createAdminClient().from("product_events")
      .insert({ event, user_id: userId, detail: cleanDetail(detail) });
    // 23505 = ซ้ำ (ปกติ) · 23503 = ผู้ใช้ถูกลบระหว่างนั้น
    if (error && error.code !== "23505" && error.code !== "23503") console.error(...);
  } catch (err) { console.error(...); }
}
```

- เก็บ map บน `globalThis` เพราะ production อาจ bundle โมดูลซ้ำหลายครั้ง (ตัวแปรระดับโมดูลจะมีหลายชุด)
- ใน layout เรียกแบบไม่รอ/อยู่ข้าง ๆ การอ่านอื่น (หรือ `after()`) — ไม่เพิ่มเวลาโหลดหน้า

### 3.4 `admin_analytics(p_days)` — หนึ่งการเรียกได้ทั้งหน้า

คืน jsonb: `dau` (วันนี้), `wau` (7 วัน), `mau` (30 วัน), `daily` (ผู้ใช้ active ต่อวัน **รวมวันที่เป็นศูนย์** ด้วย `generate_series`),
`events` (ต่อเหตุการณ์: จำนวนครั้ง + จำนวนคน), `funnel` (จำนวนคนที่ทำแต่ละขั้น **ภายในช่วง** — ไม่ใช่ cohort),
`retention` (cohort: คนที่สมัครในช่วง กลับมา active อีก 1 วัน / 7 วันหลังสมัครพอดี — นับเฉพาะคนที่สมัครนานพอ)
ช่วงเวลา 1–365 วัน (หน้าจอให้เลือก 7 / 30 / 90)

### 3.5 หน้าจอ `/admin/analytics`

- ปุ่มช่วงเวลา (ลิงก์ `?days=`), การ์ด DAU/WAU/MAU, กราฟรายวัน, funnel พร้อม % จากขั้นก่อนหน้า (`buildFunnel`; ขั้นหลังอาจมากกว่าขั้นก่อนเพราะไม่ใช่ cohort — แสดงตามจริงและจำกัดความยาวแท่ง), retention D1/D7, ตารางการใช้ฟีเจอร์
- `parseAnalytics` (zod + `.catch`) — ข้อมูลเพี้ยนบางส่วนแสดงเป็น 0 แทนหน้าแตก
- funnel ของ paywall A/B อยู่หน้า `/admin/paywall` (ทุกเหตุการณ์ funnel มี `pw_a`/`pw_b`) — หลักเดียวกัน

## 4. กฎที่ห้ามละเมิด

1. เหตุการณ์ห้ามมีเนื้อหา/ค่า/ข้อความของผู้ใช้ — แท็กผ่าน `cleanDetail` เท่านั้น
2. การบันทึกห้ามทำให้งานของผู้ใช้ล้มหรือช้า
3. นับวันตามเวลาไทยทั้งในตาราง (`bangkok_today()`) และในรายงาน
4. ตัวเลขที่หน้าแดชบอร์ดต้องมาจากการเรียกเดียว — อย่าวน query ทีละเหตุการณ์ (server กับฐานข้อมูลอยู่คนละทวีป ~230 ms ต่อครั้ง)
5. ไม่ใส่ script วิเคราะห์ของบุคคลที่สามในหน้าที่มีข้อมูลสุขภาพ

## 5. บทเรียนจากของจริง

| เกิดอะไร                                              | สาเหตุราก                                                        | แก้อย่างไร                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| ทุกหน้ามีการเขียนฐานข้อมูลเพิ่ม 1 ครั้ง (ช้า ~230 ms) | `active` ถูกเรียกจาก layout ทุกหน้า แล้วพึ่ง unique index ปฏิเสธ | จำใน `globalThis` ว่าวันนี้บันทึกแล้ว → เขียนแค่หน้าแรกของวัน |
| error log เต็มไปด้วย "duplicate key"                  | ซ้ำของเหตุการณ์ครั้งเดียวถือเป็น error                           | 23505 / 23503 คือกรณีปกติ ไม่ log                             |
| แอดมินงงว่าทำไม "สั่งซื้อ" มากกว่า "ดู paywall"       | funnel นับคนต่อขั้นในช่วง ไม่ใช่ cohort                          | เขียนหมายเหตุบนหน้าจอ และไม่บิดตัวเลขให้ดูเรียง               |

## 6. ลอกไปใช้อย่างไร

1. ตาราง + unique index ของเหตุการณ์ครั้งเดียว + ฟังก์ชันวันท้องถิ่น
2. `EVENTS` (as const) + `cleanDetail` + `trackEvent` (never throw, จำ active ต่อวัน)
3. เรียก `trackEvent` หลังงานสำเร็จในแต่ละ action; `active` จาก layout ที่ต้องล็อกอิน; `signup` ตอน consent ครบครั้งแรก
4. ฟังก์ชัน SQL รวมทุกตัวเลข + `parseAnalytics` ด้วย zod + หน้าแอดมิน (`requireAdmin`)
5. ใส่ใน PDPA export และลบตามบัญชี
6. เทส: `cleanDetail`, `buildFunnel` (หารศูนย์, ขั้นหลังมากกว่า), `retentionRate`, `parseAnalytics` (ข้อมูลเพี้ยน), RLS (ผู้ใช้อ่าน/เขียนไม่ได้)
