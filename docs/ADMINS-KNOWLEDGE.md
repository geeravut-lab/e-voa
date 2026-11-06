# Knowledge: ผู้ดูแลระบบ (Admin) — ใครเป็นแอดมิน ให้/ถอนสิทธิ์อย่างไร และหน้าแอดมินถูกกันอย่างไร (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `supabase/migrations/20261003000100_phase0_foundation.sql` (ตาราง `admins`) · `supabase/migrations/20261029000100_admin_management.sql`
> (`grant_admin`, `revoke_admin`, `user_id_by_email`) · `src/config/admin.ts` · `src/lib/auth/server.ts` (`requireAdmin`, `isAdminUser`)
> · `src/app/actions/admins.ts` · `src/app/(app)/admin/_admins/*` · `src/app/(app)/admin/page.tsx` · `scripts/grant-admin.mjs`
> · `src/config/nav.ts` (`ADMIN_NAV`) · `src/lib/shell/context(.server).ts`

---

## 1. ปัญหาที่แก้

- ต้องมีคนดูแลระบบหลายคน และให้/ถอนสิทธิ์ได้จากหน้าเว็บ — แต่ต้อง **ไม่มีทางที่ระบบจะเหลือแอดมินศูนย์คน** หรือเจ้าของถูกถอดสิทธิ์
- หน้าแอดมินต้องปิดสนิทสำหรับคนอื่น รวมถึง server action ที่ถูกเรียกตรง

## 2. สรุปสั้น

1. **สิทธิ์แอดมิน = มีแถวใน `admins`** (user_id) — ตารางเขียนได้ด้วย service role เท่านั้น
2. **ให้/ถอนสิทธิ์ผ่านฟังก์ชัน SQL สองตัวเท่านั้น** ที่บังคับกฎในฐานข้อมูล: คนทำต้องเป็นแอดมิน · ถอนตัวเองไม่ได้ · **บัญชีเจ้าของถอนไม่ได้** · ให้สิทธิ์ได้เฉพาะ **อีเมลที่มีบัญชีอยู่แล้ว** (ไม่สร้างบัญชีใหม่)
3. **บัญชีเจ้าของถูกกันสามชั้น**: ไม่วาดปุ่มถอน · server action ปฏิเสธ · ฟังก์ชัน SQL ปฏิเสธ (อีเมลเดียวกันใน `src/config/admin.ts` และ SQL — แก้ต้องแก้คู่)
4. **หน้าแอดมินตอบ 404 ให้คนอื่น** (`requireAdmin()` → `notFound()`) — ไม่บอกว่ามีหน้านี้อยู่
5. **ทุก action ของแอดมินเรียก `requireAdmin()` บรรทัดแรก** ไม่พึ่งการซ่อนเมนู
6. ให้/ถอนสิทธิ์แล้ว **แจ้งคนนั้น + แจ้งแอดมินคนอื่นทุกคน** และบันทึก audit (`admin.grant` / `admin.revoke`)
7. แอดมินคนแรกตั้งด้วยสคริปต์ `node scripts/grant-admin.mjs <อีเมล>` (หลังสมัครในแอปแล้ว) — ไม่มีหน้า "สมัครเป็นแอดมิน"
8. แอดมินมี **เมนูของตัวเอง** (`ADMIN_NAV`) และหน้าแรก `/admin`; หน้าลูกค้ายังเปิดได้ด้วย URL

## 3. โครงที่ใช้

### 3.1 ตารางและฟังก์ชัน

```sql
create table public.admins (user_id uuid primary key references auth.users (id) on delete cascade, created_at timestamptz default now());
-- RLS เปิด, revoke ทั้งหมด, grant select ให้ authenticated (นโยบายให้อ่านเฉพาะแถวตัวเอง)

-- 'ok' | 'forbidden' (คนทำไม่ใช่แอดมิน) | 'not_found' (ไม่มีบัญชีนี้) | 'already'
grant_admin(p_actor uuid, p_email text)
-- 'ok' | 'forbidden' | 'self' | 'protected' (บัญชีเจ้าของ) | 'not_admin'
revoke_admin(p_actor uuid, p_target uuid)
-- ทั้งคู่: security definer, set search_path = '', execute ได้เฉพาะ service_role,
--         เขียน privacy_audit_log ใน transaction เดียวกัน
```

- `user_id_by_email(email)` ค้นแบบไม่สนตัวพิมพ์ — service role เท่านั้น (ไม่ให้ผู้ใช้ทั่วไปใช้ไล่หาอีเมล)
- ฟังก์ชันคืน **รหัสผล** (ไม่ใช่ข้อความ) → action แปลงเป็น `err_*` → หน้าจอแปลตามภาษา

### 3.2 การตรวจสิทธิ์ทุกคำขอ

```ts
export const getCurrentUser = cache(
  async () => (await supabase.auth.getUser()).data.user,
); // ตรวจกับ auth server
export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/auth?session=expired");
  return u;
}
export const isAdminUser = cache(
  async (id) => (await getShellContext(id)).isAdmin,
); // มาจาก app_shell_context() ครั้งเดียว
export async function requireAdmin() {
  const u = await requireUser();
  if (!(await isAdminUser(u.id))) notFound();
  return u;
}
```

- `getUser()` (ตรวจกับ auth server) ไม่ใช่ `getSession()` (เชื่อ cookie) สำหรับการตัดสินสิทธิ์
- บริบทผู้ใช้ทั้งหมด (consent, แพ็กเกจ, แอดมิน, เภสัชกร, ผู้ดูแลสาขา, แจ้งเตือนที่ยังไม่อ่าน) มาจาก **ฟังก์ชัน SQL เดียว** ต่อคำขอ แชร์กันด้วย `cache()`
- route handler ของแอดมิน (เช่น CSV export) ตรวจเองด้วย — ไม่มี layout คุ้มครอง route

### 3.3 หน้าจัดการแอดมิน (การ์ด "ผู้ดูแลระบบ" ใน `/admin`)

- รายชื่อแอดมิน (ชื่อ + วิธีเข้าระบบ เช่น "เข้าระบบด้วย LINE" — ไม่แสดงอีเมลปลอม `.invalid`) และวันที่ได้สิทธิ์
- ฟอร์มให้สิทธิ์ด้วยอีเมล (`parseGrantEmail`) → `grantAdminAction`
- ปุ่มถอนสิทธิ์ **ไม่วาด** สำหรับตัวเองและบัญชีเจ้าของ; action ยังตรวจซ้ำทั้งสองกรณีก่อนเรียกฐานข้อมูล
- แจ้งเตือน: คนที่ได้/เสียสิทธิ์ (`adminAccessNotice`) และแอดมินคนอื่น (`adminAccessOthersNotice` พร้อมชื่อ) — **ในแอปและ LINE**

### 3.4 เมนูและหน้าแรกของแอดมิน

- `shellRoleOf`: แอดมินมาก่อนบทบาทอื่น → `ADMIN_NAV` (กลุ่มตามการ์ดของหน้าแอดมิน) + bottom bar ของแอดมิน (ภาพรวม · รายได้และกำไร · ร้านค้า · แจ้งเตือน)
- หน้า `/admin` = ศูนย์รวมการ์ด (ตัวเลขงานค้างจาก `admin_queue_counts()` ครั้งเดียว, จุดแดงเมื่อมีงานรอ)
- แอดมินแก้ข้อมูลร้านค้าได้เฉพาะสำนักงานใหญ่; สาขาอื่นดูอย่างเดียว (`?branch=`)

## 4. กฎที่ห้ามละเมิด

1. ห้ามเขียนตาราง `admins` ตรงจากโค้ดแอป — ผ่าน `grant_admin` / `revoke_admin` เท่านั้น
2. ห้ามให้สิทธิ์ด้วยการสร้างบัญชีใหม่จากอีเมล (คนที่ไม่เคยยืนยันอีเมลจะได้สิทธิ์แอดมิน)
3. ห้ามถอนตัวเอง และห้ามถอนบัญชีเจ้าของ — บังคับในฐานข้อมูล ไม่ใช่แค่หน้าจอ
4. หน้า/route/action ของแอดมินทุกตัว `requireAdmin()` (route handler ตรวจเอง)
5. ตอบ 404 ไม่ใช่ 403 สำหรับหน้าแอดมิน
6. การเปลี่ยนสิทธิ์ต้องแจ้งทุกฝ่ายและบันทึก audit

## 5. บทเรียนจากของจริง

| เกิดอะไร                                      | สาเหตุราก                         | แก้อย่างไร                                               |
| --------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| แอดมินเห็นเมนูลูกค้าปนกับงานแอดมิน หาเมนูยาก  | แอดมินใช้เมนูลูกค้า + การ์ดแอดมิน | `ADMIN_NAV` แยก + หน้าแรก `/admin`                       |
| รายชื่อแอดมินแสดงอีเมลแปลก ๆ `…@line.invalid` | บัญชี LINE/SSO ไม่มีอีเมลจริง     | `loadPeople()` / `describePerson()`: ชื่อ + วิธีเข้าระบบ |
| แอดมินคนอื่นไม่รู้ว่ามีคนได้สิทธิ์เพิ่ม       | บันทึกไว้แค่ใน log                | แจ้งแอดมินทุกคน (log ไม่ใช่การแจ้ง)                      |
| ทุกหน้าเรียกฐานข้อมูลหลายครั้งเพื่อตรวจบทบาท  | ตรวจแยกทีละตาราง                  | `app_shell_context()` ครั้งเดียวต่อคำขอ                  |

## 6. ลอกไปใช้อย่างไร

1. ตาราง `admins` + `user_id_by_email` + `grant_admin` / `revoke_admin` (ใส่อีเมลเจ้าของเป็นค่าคงที่ใน SQL และใน config)
2. สคริปต์ให้สิทธิ์แอดมินคนแรก (รันด้วย service role)
3. `getCurrentUser` / `requireUser` / `isAdminUser` / `requireAdmin` (404) — `cache()` ต่อคำขอ
4. การ์ดจัดการแอดมิน + action ที่ตรวจซ้ำ + แจ้งเตือน + audit
5. เมนูแอดมินแยก
6. เทส: ฟังก์ชัน SQL ทุกรหัสผล (Postgres ในหน่วยความจำ), ผู้ใช้ทั่วไปเขียน `admins` ไม่ได้, `/admin` เป็น 404 สำหรับลูกค้า, ปุ่มถอนไม่แสดงกับเจ้าของ/ตัวเอง
