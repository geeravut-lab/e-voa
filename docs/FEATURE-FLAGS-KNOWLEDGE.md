# Knowledge: สวิตช์ฟีเจอร์ (เปิด/ปิดฟีเจอร์โดยไม่ต้อง deploy) (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `src/lib/flags/{flags.ts,server.ts}` · `src/app/actions/admin.ts` (`setFeatureFlagAction`) · `src/app/(app)/admin/flags/page.tsx`
> · `src/config/nav.ts` (`NavItem.flags`, `disabledNavHrefs`) · `src/app/(app)/layout.tsx` · `src/lib/settings/server.ts` (cache)
> · `supabase/migrations/20261003000100_phase0_foundation.sql` (`platform_settings.feature_flags`)
> แนวคิดตั้งต้น: `docs/09-feature-flags.md` — ไฟล์นี้คือสิ่งที่ RooSuk ทำจริงบน Next.js 16

---

## 1. ปัญหาที่แก้

ต้องปิดฟีเจอร์ได้ทันทีเมื่อมีปัญหา (AI ตอบผิด ผู้ให้บริการล่ม กฎหมายยังไม่พร้อม) หรือเปิดทีละส่วนตอนเปิดตัว
— และ **"ปิด" ต้องปิดจริง** ไม่ใช่แค่ซ่อนปุ่ม (server action ยังเรียกได้จาก URL/สคริปต์)

## 2. สรุปสั้น

1. **รายชื่อสวิตช์อยู่ในโค้ด** (`FEATURE_FLAGS`, as const) ค่าที่ตั้งอยู่ในฐานข้อมูล
2. **เก็บเฉพาะสวิตช์ที่ "ปิด"** (`{"food_scan": false}`) — key ที่ไม่มี = เปิด → เพิ่มสวิตช์ใหม่ในโค้ดไม่มีวันปิดของที่เปิดใช้อยู่แล้วโดยไม่ตั้งใจ
3. **ปิดได้สามชั้นพร้อมกัน**: เมนูเป็นสีเทากดไม่ได้ · หน้า `notFound()` · server action/route `assertFeature()` บรรทัดแรก → `err_feature_off`
4. หน้าเปิดใช้ `featureEnabled()` แล้ว `notFound()` — **ห้าม throw `assertFeature` จากหน้า** (นั่นสำหรับ action)
5. บันทึก: อ่าน → `withFlag` → UPDATE แถวเดียว **นับแถว** → ล้าง cache → audit; มีผลภายในประมาณหนึ่งนาทีในทุก instance

## 3. โครงที่ใช้

### 3.1 โค้ดฝั่ง pure

```ts
export const FEATURE_FLAGS = [
  "food_scan",
  "lab_scan",
  "body_scan",
  "monthly_report",
  "health_vault",
  "health_passport",
  "insights",
  "barcode_scan",
  "health_agent",
  "wearables",
  "family",
  "marketplace",
  "corporate",
  "creator",
  "booking",
  "voice",
  "checkup_lead",
  "goals",
  "diet_watch",
  "liver_check",
  "ekyc",
  "telepharmacy",
] as const;

export const isEnabled = (flags, flag) => flags?.[flag] !== false; // ไม่มี key = เปิด
export function normalizeFlags(raw); // เก็บเฉพาะ key ที่รู้จักและเป็น false; ทิ้งอย่างอื่นจากฐานข้อมูล
export function withFlag(flags, flag, enabled); // เปิด = ลบ key, ปิด = เขียน false
```

### 3.2 ฝั่ง server

```ts
export async function getFlags() {
  return (await loadPlatformSettings()).featureFlags;
} // cache 30 วินาที
export async function featureEnabled(flag) {
  return isEnabled(await getFlags(), flag);
}
/** ซ่อนปุ่มไม่ใช่การปิดฟีเจอร์ — ใส่บรรทัดแรกของทุก server action / route ของฟีเจอร์ */
export async function assertFeature(flag) {
  if (!(await featureEnabled(flag))) throw new AppError("err_feature_off");
}
```

| ชั้น          | ทำอะไร                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| เมนู          | `NavItem.flags: [...]` — `disabledNavHrefs(flags)` คืน href ที่ **ทุก** flag ของมันปิด → layout ส่งให้ `AppShell` วาดเป็นสีเทา (`aria-disabled`, ไม่ใช่ลิงก์) ทั้ง sidebar, bottom bar, แผ่น "เพิ่มเติม" และการ์ดหน้าแรก |
| หน้า          | `if (!(await featureEnabled("telepharmacy"))) notFound();` — รวมถึงหน้า public เช่นลิงก์พาสปอร์ต                                                                                                                         |
| action/route  | `await assertFeature("goals")` บรรทัดแรก ก่อนตรวจอย่างอื่น                                                                                                                                                               |
| งานเบื้องหลัง | งานใน tick 10 นาทีของฟีเจอร์นั้นเช็ก `featureEnabled()` ก่อนทำ (เช่น รายงานรายเดือน, agent, food watch, goals) — แยกกับสวิตช์ "กฎอัตโนมัติ" ใน `/admin/rules`                                                            |

เมนูที่มีหลาย flag (เช่น "สแกน" = food_scan, lab_scan, body_scan) จะเทาเมื่อ **ทุกตัว** ปิด — ปิดแค่ตัวเดียว เมนูยังเข้าได้ แต่ปุ่มของส่วนนั้นในหน้าเป็นสีเทา

### 3.3 หน้าแอดมิน `/admin/flags`

- รายการสวิตช์ทั้งหมดจากโค้ด + ชื่ออ่านง่าย (`flag_<name>` ในพจนานุกรม) + สถานะ
- **ที่ปิดอยู่แสดงเป็นสีส้ม** (เห็นชัดว่าอะไรปิดอยู่ ไม่ต้องอ่านทีละบรรทัด)
- ปุ่มเปิด/ปิดเป็นฟอร์มเล็ก (`flag`, `enabled`) → `setFeatureFlagAction` (มี spinner, กดซ้ำไม่ได้)

### 3.4 บันทึก

```ts
const admin = await requireAdmin();
if (!isFeatureFlag(flag)) throw new AppError("err_invalid_input");
const next = withFlag(normalizeFlags(row.feature_flags), flag, enabled);
const { data } = await db
  .from("platform_settings")
  .update({ feature_flags: next, updated_by: admin.id })
  .eq("id", true)
  .select("id");
if (data?.length !== 1) throw new AppError("err_save_failed"); // UPDATE ที่ไม่โดนแถว = "สำเร็จ" ใน PostgREST
await audit({
  by: admin.id,
  action: "settings.feature_flag",
  entity: "platform_settings",
  entityId: flag,
  detail: { enabled },
});
invalidatePlatformSettingsCache(); // instance นี้เห็นทันที instance อื่นภายใน 30 วินาที
```

`platform_settings` เป็นแถวเดียว (`id boolean primary key = true`) อ่านผ่าน cache เดียวบน `globalThis`
(production อาจ bundle โมดูลซ้ำต่อ route — ตัวแปรระดับโมดูลจะทำให้อ่านซ้ำหลายครั้งต่อหน้า)

## 4. กฎที่ห้ามละเมิด

1. ทุก server action / route ของฟีเจอร์ต้องมี `assertFeature` บรรทัดแรก
2. หน้าของฟีเจอร์ต้อง `notFound()` เมื่อปิด (อย่าโชว์หน้าครึ่ง ๆ)
3. เก็บเฉพาะค่าที่ปิด และทิ้ง key ที่ไม่รู้จัก (`normalizeFlags`)
4. เมนูของฟีเจอร์ที่ปิดต้องยังเห็นแต่เป็นสีเทา (คนจะไม่งงว่าเมนูหายไปไหน) และกดไม่ได้จริง
5. อย่าใช้สวิตช์ฟีเจอร์แทนสิทธิ์ (role) หรือแทนแพ็กเกจ — คนละเรื่อง

## 5. บทเรียนจากของจริง

| เกิดอะไร                                               | สาเหตุราก                                       | แก้อย่างไร                                |
| ------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| ปิดฟีเจอร์แล้วเมนูยังกดเข้าได้ หน้าโหลดแต่ใช้งานไม่ได้ | ตรวจแค่ใน action                                | เมนูเทา + หน้า `notFound()`               |
| หน้าที่เรียก `assertFeature` แสดง error page แทน 404   | ใช้ตัวที่ throw ในหน้า                          | หน้าใช้ `featureEnabled()` + `notFound()` |
| แอดมินไม่เห็นว่าอะไรปิดอยู่                            | สถานะเป็นตัวหนังสือเหมือนกันหมด                 | ที่ปิดเป็นสีส้ม                           |
| หน้าแอดมินอ่าน settings 4–8 ครั้งต่อหน้า               | cache เป็นตัวแปรระดับโมดูลที่ถูก bundle หลายชุด | cache เดียวบน `globalThis`                |

## 6. ลอกไปใช้อย่างไร

1. คอลัมน์ `feature_flags jsonb default '{}'` ในตาราง settings แถวเดียว
2. `flags.ts` (รายชื่อ + `isEnabled`/`normalizeFlags`/`withFlag`) และ `server.ts` (`getFlags`/`featureEnabled`/`assertFeature`)
3. ผูก `flags` กับรายการเมนู + `disabledNavHrefs` + วาดสีเทา
4. ทุกหน้า/ action ของฟีเจอร์: `notFound()` / `assertFeature()`
5. หน้าแอดมิน + action ที่นับแถว + audit + ล้าง cache
6. เทส: `normalizeFlags` (key แปลก, ค่า true), `withFlag`, `disabledNavHrefs` (หลาย flag), Playwright: เมนูของฟีเจอร์ที่ปิดเป็นสีเทาและกดไม่ได้, action ตอบ `err_feature_off`
