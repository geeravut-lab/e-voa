# Knowledge: Audit trail — บันทึกว่าใครทำอะไร เมื่อไร กับข้อมูลไหน (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `supabase/migrations/20261212000100_audit_log.sql` (ตาราง, ตัวกันแก้/ลบ, `admin_purge_audit`, `audit_row_change`)
> · `supabase/migrations/20261219000100_audit_switches.sql` (สวิตช์บันทึก) · `src/lib/audit/{audit.ts,server.ts,read.server.ts,query.ts}`
> · `src/lib/audit/coverage.test.ts` · `src/app/actions/audit.ts` · `src/app/(app)/admin/audit/*`

---

## 1. ปัญหาที่แก้

เมื่อมีเรื่องผิดปกติ (เงินหาย สต็อกไม่ตรง ราคาโดนแก้ สิทธิ์แอดมินถูกให้) ต้องย้อนดูได้ว่า **ใคร ทำอะไร เมื่อไร กับข้อมูลไหน**
— โดยที่บันทึกนั้น **แก้/ลบไม่ได้** (ไม่งั้นคนทำผิดลบหลักฐานได้) และ **ไม่กลายเป็นแหล่งรั่วของข้อมูลส่วนบุคคล** เสียเอง

## 2. สรุปสั้น

1. **ตารางเดียวทั้งระบบ** `audit_log`: who (`actor_id` + `actor_role`) · what (`action` แบบจุด เช่น `shop.order.confirm_paid`) · which (`entity`, `entity_id`, `branch_id`) · `detail` (id, รหัส, สถานะ, ตัวเลขเท่านั้น)
2. **สองผู้เขียน**: server action เรียก `audit({...})` **หลัง** งานสำเร็จ (รู้ว่าใครทำ) + **trigger ในฐานข้อมูล** บนตารางเงิน/เจ้าหน้าที่ (`source = 'db'`) — การเปลี่ยนที่มาจากทางที่ไม่มีใครคิดถึงก็ยังทิ้งร่องรอย
3. **append-only จริง**: trigger ห้าม UPDATE / TRUNCATE / DELETE; ลบได้ทางเดียวคือ `admin_purge_audit()` ที่ลบเฉพาะแถว **เก่ากว่า 4 ปี** และบันทึกการลบไว้ตลอดไป
4. **ไม่มีข้อมูลส่วนบุคคล**: `cleanDetail` ทิ้ง key ที่ชื่อสื่อถึงชื่อ ที่อยู่ เบอร์ อีเมล รหัสผ่าน token ข้อความอิสระ; trigger คัดลอกค่าเก่า/ใหม่เฉพาะคอลัมน์ที่ระบุว่าปลอดภัย
5. **`audit()` ไม่เคย throw** — เขียนพลาด = log (trigger ฝั่งฐานข้อมูลยังเก็บการเปลี่ยนไว้)
6. **เทสบังคับ**: ไฟล์ action ที่ตรวจสิทธิ์เจ้าหน้าที่แต่ไม่ import `audit` → build ไม่ผ่าน
7. **ไม่มี FK** ไปหาคนหรือสาขา — บันทึกอยู่ต่อแม้บัญชีหรือสาขาถูกลบ
8. แอดมินดู/กรอง/ส่งออก CSV ได้ที่ `/admin/audit` (การส่งออกก็ถูกบันทึก) และ **เปิด/ปิดการบันทึกรายกลุ่มได้** แต่การเปลี่ยนสวิตช์เองถูกบันทึกเสมอ

## 3. โครงที่ใช้

### 3.1 ตาราง

```sql
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null default 'app' check (source in ('app', 'db')),
  actor_id uuid,                -- null = ระบบ / งานตามเวลา / แก้ฐานข้อมูลตรง
  actor_role text check (actor_role in ('admin','branch_manager','pharmacist','customer','courier','system')),
  action text not null check (length(action) between 3 and 120),
  entity text not null, entity_id text, branch_id uuid,
  detail jsonb not null default '{}' check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4096)
);
-- index: (at desc), (actor_id, at), (entity, entity_id, at), (branch_id, at), (action text_pattern_ops, at)
-- RLS เปิด, revoke ทั้งหมด → service role เท่านั้น
-- triggers: audit_log_no_update, audit_log_no_truncate, audit_log_no_delete (ยกเว้นภายใน admin_purge_audit)
create table public.audit_purges (...)   -- ใคร ลบเมื่อไร กี่แถว ก่อนวันที่เท่าไร — append-only ไม่มีวันลบ
```

### 3.2 ผู้เขียนที่ 1: server action

```ts
await audit({
  by: scope.userId, // role หาเองถ้าไม่ส่ง (shellRoleOf) — ส่ง role มาเองถ้ารู้ เพื่อประหยัด round trip
  action: "shop.order.confirm_paid", // ต้องตรง isAuditAction: คำตัวเล็กคั่นด้วยจุด
  entity: "shop_orders",
  entityId: id,
  branchId: scope.branch.id,
  detail: { orderNo: o.order_no, to: "paid" }, // ผ่าน cleanDetail: ≤20 key, string ≤120, list ≤20
});
```

- เรียก **หลัง** งานสำเร็จ (ไม่บันทึกสิ่งที่ไม่ได้เกิด)
- ตั้งชื่อ action เป็นหมวดก่อน: `shop.*`, `stock.*`, `settings.*`, `admin.*`, `auth.*`, `payment.*`, `branch.*`, `ai.*` … (คำแรก = "กลุ่ม" ที่เปิด/ปิดได้)
- ตัวอย่างความปลอดภัย: `auth.password_change`, `admin.grant`, `admin.revoke`, `settings.feature_flag`, `audit.export`, `audit.purge`, `audit.switches`

### 3.3 ผู้เขียนที่ 2: trigger ในฐานข้อมูล

```sql
create trigger audit_shop_orders after insert or update or delete on public.shop_orders
  for each row execute function public.audit_row_change('status,total_thb,...', 'updated_at');
--  tg_argv[0] = คอลัมน์ที่คัดลอกค่าเก่า/ใหม่ได้ (ไม่มีข้อมูลส่วนบุคคล)
--  tg_argv[1] = คอลัมน์ที่เปลี่ยนตลอดและไม่มีความหมาย (ข้าม)
```

บันทึก `action = 'db.<table>.<op>'` + รายชื่อคอลัมน์ที่เปลี่ยน + ค่าเก่า/ใหม่ของคอลัมน์ที่อนุญาตเท่านั้น
ตาราง settings บันทึก **แค่ชื่อคอลัมน์** (บางคอลัมน์เก็บ secret)
ตารางที่เฝ้า: ออเดอร์ สินค้า ราคาสาขา พาร์ตเนอร์ ค่าส่ง การชำระเงิน เครดิต สาขา ผู้ดูแลสาขา เภสัชกร แอดมิน settings กฎอัตโนมัติ เงื่อนไขโรค การปรึกษา e-KYC ตั้งค่า AI ใบโอน ฯลฯ
**เพิ่มตารางเงิน/เจ้าหน้าที่ใหม่ = เพิ่ม trigger นี้ใน migration ของมัน**

### 3.4 สวิตช์การบันทึก (`/admin/audit`)

- `platform_settings.audit_enabled` + `audit_off_groups` (รายชื่อกลุ่มคั่นด้วย comma, CHECK รูปแบบ)
- **ประตูเดียว** `audit_log_gate` (BEFORE INSERT) ใช้กับทั้งสองผู้เขียน: กลุ่ม = คำแรกของ action หรือ `db` สำหรับ trigger;
  ทิ้งแถวของกลุ่มที่ปิด หรือทิ้งทั้งหมดเมื่อปิดการบันทึก — **ยกเว้นกลุ่ม `audit`** (เปลี่ยนสวิตช์ ส่งออก ลบ) บันทึกเสมอ
- รายการกลุ่ม = `AUDIT_KINDS` + กลุ่มที่ "เคยเห็น" ในบันทึกล่าสุด (`loadSeenKinds`) → กลุ่มใหม่โผล่ให้ปิดได้เองโดยไม่ต้องแก้โค้ด

### 3.5 ดู กรอง ส่งออก ลบ

- กรองด้วย URL (`readAuditFilter`): ช่วงวันที่ (วันไทย), ผู้กระทำ, บทบาท, กลุ่ม/action, entity, สาขา — **CSV ใช้ตัวกรองเดียวกัน** (ส่งออกตรงกับที่เห็น)
- แบ่งหน้าด้วย cursor (`before = id สุดท้าย`) ไม่ใช่ offset (ตารางโตเร็ว)
- แสดงชื่อผู้กระทำด้วย `people_lookup` (เรียกครั้งเดียวต่อหน้า) — ชื่อไม่ได้อยู่ในบันทึก
- ลบ: แอดมินพิมพ์ยืนยัน → `admin_purge_audit(actor)` — ฟังก์ชันตรวจว่าเป็นแอดมิน ลบเฉพาะ > 4 ปี เขียน `audit_purges` และบันทึกในล็อก
- สคริปต์ล้างข้อมูลก่อนเปิดตัว (เจ้าของรันครั้งเดียว) เป็นทางอื่นทางเดียวที่ล้างได้

### 3.6 เทสกันลืม (`coverage.test.ts`)

```ts
const STAFF_CHECK =
  /requireAdmin\(|authorizeShopWrite\(|authorizeOrderWrite\(|.../;
for (const f of actionFiles)
  if (STAFF_CHECK.test(src)) {
    expect(src).toMatch(/from "@\/lib\/audit\/server"/);
    expect(src).toMatch(/\baudit(Trail)?\(\{/);
  }
```

## 4. กฎที่ห้ามละเมิด

1. ห้ามใส่ข้อมูลส่วนบุคคลใน `detail` (ชื่อ ที่อยู่ เบอร์ อีเมล token เลขใบอนุญาต ข้อความอิสระ) — ใส่ id แล้วไปเปิดดูจากตารางต้นทาง
2. ห้ามเปิดทางแก้/ลบแถวบันทึก นอกจากฟังก์ชันลบที่จำกัดอายุและบันทึกตัวเอง
3. `audit()` ต้องไม่ทำให้งานหลักล้ม และต้องเรียกหลังงานสำเร็จ
4. action ใหม่ของเจ้าหน้าที่ = เรียก `audit`; ตารางเงิน/เจ้าหน้าที่ใหม่ = เพิ่ม trigger
5. การปิดบันทึกต้องถูกบันทึกเสมอ

## 5. บทเรียนจากของจริง

| เกิดอะไร                                                       | สาเหตุราก                      | แก้อย่างไร                                            |
| -------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| แต่ละ action มี log ของตัวเองคนละรูปแบบ ตามหาเรื่องเดียวไม่ได้ | ไม่มีตารางกลาง                 | `audit_log` เดียว + ชื่อ action แบบจุด                |
| แก้ข้อมูลตรงในฐานข้อมูลแล้วไม่มีร่องรอย                        | บันทึกเฉพาะใน action           | trigger `audit_row_change` บนตารางสำคัญ               |
| บันทึกช้าลงทุก action (หา role อีก 1 round trip)               | `audit()` อ่านบทบาทเองทุกครั้ง | ส่ง `role` มาเมื่อรู้อยู่แล้ว (เช่นอัปโหลดรูปหลายรูป) |
| ต้องการลดปริมาณบันทึกบางกลุ่ม                                  | ปิด/เปิดได้แค่ทั้งหมด          | สวิตช์รายกลุ่มที่ประตูเดียว + กลุ่ม `audit` ปิดไม่ได้ |

## 6. ลอกไปใช้อย่างไร

1. ตาราง `audit_log` + `audit_purges` + trigger กันแก้/ลบ + `admin_purge_audit` (ตั้งอายุตามกฎหมายของคุณ)
2. `audit_row_change(allowed_cols, ignored_cols)` + trigger บนตารางเงิน/สิทธิ์/settings
3. `cleanDetail` + `isAuditAction` + `audit()` (never throw)
4. เรียก `audit()` ในทุก action ของเจ้าหน้าที่/เงิน/ความปลอดภัย + `coverage.test.ts`
5. สวิตช์รายกลุ่ม (ถ้าต้องการ) ด้วย BEFORE INSERT ตัวเดียว
6. หน้าแอดมิน: กรอง (URL), cursor, CSV (บันทึกการส่งออก), ลบตามอายุ (พิมพ์ยืนยัน)
7. เทส: แก้/ลบแถวไม่ได้ (Postgres ในหน่วยความจำ), purge ลบเฉพาะแถวเก่า, `cleanDetail` ทิ้ง key ต้องห้าม, gate ทิ้งกลุ่มที่ปิดแต่ไม่ทิ้ง `audit`
