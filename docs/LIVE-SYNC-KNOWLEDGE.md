# Knowledge: อัปเดตสถานะให้ผู้ใช้ที่ล็อกอินอยู่เห็นทันที โดยไม่ต้องกด refresh (Live sync) (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `supabase/migrations/20261220000200_live_signals.sql` (`live_ping`, trigger, นโยบายผู้ฟัง) · `src/components/shell/LiveSync.tsx` (ฝั่ง browser)
> · `src/lib/live/watch.ts` (หน้าไหนฟังอะไร, หัวข้อ topic, ช่วงรอ) · `src/app/api/live/route.ts` (ลายนิ้วมือสำรอง) · `src/app/api/live/token/route.ts` (token ให้ socket)
> · `src/app/(app)/layout.tsx` (ส่งบทบาทให้ `LiveSync`) · `supabase/tests/live-signals.test.ts`, `src/lib/live/watch.test.ts`
> เรื่องที่ทำงานคู่กัน: แจ้งเตือนในแอป/LINE → `docs/LINE-NOTIFICATIONS-KNOWLEDGE.md` · งานตามเวลา → `docs/AUTOMATION-RULES-KNOWLEDGE.md`

---

## 1. ปัญหาที่แก้

หลายคนดูเรื่องเดียวกันพร้อมกัน: ลูกค้ารอผลการชำระเงิน แอดมินตรวจสลิป ผู้ดูแลสาขาเตรียมออเดอร์ เภสัชกรรับสายปรึกษา
ถ้าต้องกด refresh เอง ลูกค้าจะนั่งกดซ้ำ เจ้าหน้าที่จะไม่เห็นงานใหม่ และจะเกิดการทำซ้ำหรือทำช้า — ผู้ใช้ต้องเห็นการเปลี่ยนแปลง **ภายในไม่กี่วินาที**

เวอร์ชันแรกของ RooSuk ใช้ **polling**: ทุกแท็บที่เปิดอยู่ถามเซิร์ฟเวอร์ทุก 5–12 วินาทีว่า "มีอะไรเปลี่ยนไหม" แต่ละครั้งเสีย 1 การเรียก Netlify function + 3 การเรียกฐานข้อมูล
(ข้ามทวีป ~230 ms ต่อครั้ง) — แท็บที่เปิดทิ้งไว้เฉย ๆ ก็ยังกินทรัพยากรตลอด จึงเปลี่ยนเป็น **ให้ฐานข้อมูลเป็นฝ่ายบอก** และเก็บ polling ไว้เป็นทางสำรอง

## 2. สรุปสั้น

1. **ฐานข้อมูลส่งสัญญาณ "ping" ที่ไม่มีข้อมูล** บนช่อง Realtime แบบ private เมื่อมีอะไรเปลี่ยน (trigger เรียก `live_ping(topic)`); ping บอกแค่ว่า "มีอะไรขยับ" — **ไม่มีเนื้อหา**
2. **หน้าจอที่เปิดอยู่รับ ping แล้ว `router.refresh()`** — อ่านข้อมูลใหม่จากเซิร์ฟเวอร์ด้วยสิทธิ์ของตัวเอง (RLS/ตรวจบทบาทเหมือนเปิดหน้าปกติ) จึงไม่มีทางที่ข้อมูลรั่วผ่านสัญญาณ
3. **Topic แบ่งตามผู้ที่เกี่ยวข้อง**: `u:<user>` (แจ้งเตือนและเรื่องของตัวเอง) · `tele` · `pharm:<branch>` · `branch:<branch>` · `admin`
4. **ใครฟัง topic ไหนได้ ตัดสินที่ฐานข้อมูล** (นโยบาย `live_signals_listen` บน `realtime.messages`) ไม่ใช่ที่ JavaScript
5. **ส่งสัญญาณพลาดต้องไม่ทำให้งานหลักล้ม**: `live_ping` กลืนทุก error และไม่ทำอะไรในที่ที่ไม่มี Realtime (เช่นฐานข้อมูลทดสอบในหน่วยความจำ)
6. **สำรองสองชั้น**: ถ้า socket เปิดไม่ได้หรือหลุด → ถามลายนิ้วมือ `/api/live` เป็นระยะ (ช้าลงเรื่อย ๆ ตอนเงียบ); ตอน socket ต่อได้/กลับมาที่แท็บ → ถามหนึ่งครั้งเพื่อตามให้ทัน
7. **ไม่ refresh ใต้มือผู้ใช้**: ไม่ทำกับหน้าแชต/หน้าถ่ายภาพ/ฟอร์มที่กำลังพิมพ์ (รอแล้วลองใหม่), และพักเมื่อแท็บถูกซ่อน
8. **client ของ socket ไม่แตะคุกกี้ล็อกอินเด็ดขาด** — ใช้ token ที่เซิร์ฟเวอร์ให้ (`/api/live/token`) ไม่รีเฟรช session เอง

## 3. สถาปัตยกรรม

```
 การเปลี่ยนข้อมูล (ลูกค้า/เจ้าหน้าที่/งานตามเวลา)
        │  INSERT/UPDATE ตารางที่หน้าจอแสดง
        ▼
 trigger (security definer) ──► live_ping('u:<user>' | 'branch:<id>' | 'admin' | …)
        │                         = realtime.send('{}', 'ping', topic, private := true)   ← กลืน error ทุกชนิด
        ▼
 Supabase Realtime (broadcast, private channel)  ──นโยบาย live_signals_listen ตรวจผู้ฟัง──►
        ▼
 LiveSync (client component ใน AppShell) รับ 'ping' ──► debounce 300 ms ──► router.refresh()
        │                                                           (ข้ามถ้ากำลังพิมพ์ / แท็บซ่อน / หน้าห้าม refresh)
        └─ ถ้า socket ไม่ได้: GET /api/live?w=notif,admin → ลายนิ้วมือ (นับ+id) → ต่างจากครั้งก่อน = router.refresh()
```

### 3.1 ฝั่งฐานข้อมูล

```sql
create function public.live_ping(p_topic text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'ping', p_topic, true);     -- payload ว่าง, private
exception when others then null;                                  -- ห้ามทำให้การเขียนล้ม
end; $$;
revoke all on function public.live_ping(text) from public, anon, authenticated;
grant execute on function public.live_ping(text) to service_role;
```

trigger ตัวอย่าง (แจ้งเตือนใหม่/อ่านแล้ว → ปลุกหน้าจอของเจ้าของ):

```sql
create function public.live_notifications() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.live_ping('u:' || new.user_id::text); return null; end; $$;
create trigger live_app_notifications after insert or update of read_at on public.app_notifications
  for each row execute function public.live_notifications();
```

| Topic             | ใครฟัง                | trigger ที่ปลุก                                                        |
| ----------------- | --------------------- | ---------------------------------------------------------------------- |
| `u:<user id>`     | เจ้าของบัญชี          | แจ้งเตือนใหม่/อ่านแล้ว, การปรึกษาของผู้ป่วย                            |
| `tele`            | ผู้ใช้ที่ล็อกอินทุกคน | จำนวนเภสัชกรว่าง/สายรอเปลี่ยน                                          |
| `pharm:<branch>`  | เภสัชกรของสาขานั้น    | คิวปรึกษา, สถานะเภสัชกรของสาขา                                         |
| `branch:<branch>` | ผู้ดูแลของสาขานั้น    | ออเดอร์ใหม่/เปลี่ยนสถานะ                                               |
| `admin`           | แอดมิน                | การชำระเงินใหม่/เปลี่ยนสถานะ, e-KYC, ลีดตรวจสุขภาพ, ออเดอร์, การปรึกษา |

**แนวทาง "ping ตามเหตุการณ์ที่มีคนรอ"**: การเปลี่ยนที่ผู้ใช้ต้องเห็น (สถานะออเดอร์, ผลการชำระเงิน, ผลตรวจตัวตน) **ส่งแจ้งเตือนถึงผู้ใช้อยู่แล้ว** (`notifyUser`)
→ trigger ของ `app_notifications` ปลุก `u:<user>` → หน้าที่ผู้ใช้เปิดอยู่ refresh เอง **ไม่ต้องมี trigger แยกต่อตารางสำหรับฝั่งลูกค้า**
เฉพาะฝั่งเจ้าหน้าที่ที่ต้องเห็น "งานใหม่ที่ยังไม่มีใครแจ้ง" (คิว, ออเดอร์เข้า) จึงมี trigger เฉพาะ — trigger ใช้ `WHEN (old.status IS DISTINCT FROM new.status)` เพื่อไม่ปลุกเพราะการแก้ฟิลด์ที่ไม่เกี่ยว

### 3.2 นโยบายผู้ฟัง

```sql
create policy live_signals_listen on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast' and (
       (select realtime.topic()) = 'u:' || (select auth.uid())::text      -- ฟังได้เฉพาะของตัวเอง
    or (select realtime.topic()) = 'tele'
    or ((select realtime.topic()) = 'admin' and public.live_is_admin())
    or public.live_may_hear_branch((select realtime.topic()))             -- ผู้ดูแล/เภสัชกรของสาขานั้นเท่านั้น
  ));
```

- ฟังก์ชันตรวจบทบาท (`live_is_admin`, `live_may_hear_branch`) เป็น `security definer` — นโยบายต้องไม่ขึ้นกับ RLS ของผู้ใช้
- สร้างนโยบายเฉพาะเมื่อมี `realtime.messages` (`to_regclass`) — ฐานข้อมูลทดสอบไม่มี Realtime จึงไม่พัง
- นโยบายนี้ต้องอาศัย partition ของ `realtime.messages` ซึ่ง Supabase สร้างให้เมื่อมีการใช้ private channel ครั้งแรก — ตรวจว่าคำสั่งสร้างนโยบายใน migration รันผ่านจริงบนโปรเจกต์ (ถ้าตารางยังไม่มี นโยบายจะไม่ถูกสร้าง)
- แม้ผู้ใช้ "แอบ" subscribe topic ของคนอื่น ก็ได้แค่ปฏิเสธ และต่อให้ได้ ก็ได้แค่ `{}` — ไม่มีข้อมูล

### 3.3 ฝั่ง browser (`LiveSync`)

- วางครั้งเดียวใน `AppShell` ได้ `who` จาก layout: `{ userId, isAdmin, isPharmacist, isBranchManager, staffBranchId }`
- `liveTopicsFor(pathname, who)`: ทุกหน้าฟัง `u:<user>`; หน้า `/telepharmacy` เพิ่ม `tele`; `/pharmacist` เพิ่ม `pharm:<branch>`; `/branch` เพิ่ม `branch:<branch>`; `/admin` เพิ่ม `admin` — **ฟังเฉพาะสิ่งที่หน้านั้นแสดง** (ไม่เปิด channel เกินจำเป็น เพราะโควตาการเชื่อมต่อของ Supabase นับต่อแท็บ)
- `liveConfigFor(pathname)`: `keys` สำหรับ fallback, `intervalMs` (5 วินาทีหน้าปรึกษา/เภสัชกร, 8 วินาทีสาขา/แอดมิน, 12 วินาทีทั่วไป), `refresh` (false ที่ `/ask`, `/agent`, `/scan`, `/today/checkin`, `/consent`)
- ใช้ `createClient` ของ `@supabase/supabase-js` **ธรรมดา** (`persistSession:false, autoRefreshToken:false, detectSessionInUrl:false`) — ไม่ใช่ client แบบ SSR ที่แตะคุกกี้

```ts
const token = await fetch("/api/live/token"); // เซิร์ฟเวอร์ยืนยันตัวตนและรีเฟรชคุกกี้ตามปกติ แล้วส่ง access token
supabase.realtime.setAuth(token);
setInterval(refetchTokenAndSetAuth, 45 * 60 * 1000); // token อายุราว 1 ชม. ต่อให้ใหม่ก่อนหมดมาก
for (const topic of topics)
  supabase
    .channel(topic, { config: { private: true } })
    .on("broadcast", { event: "ping" }, () => {
      quiet = 0;
      refreshSoon();
    })
    .subscribe((status) => onState(topic, status)); // ทุก topic SUBSCRIBED = เชื่อมต่อ; หลุดตัวใดตัวหนึ่ง = ใช้ fallback
```

- `refreshSoon()` debounce 300 ms (หลาย ping ติดกัน = refresh ครั้งเดียว); ถ้า `typing()` (ช่องกรอกที่มีค่า) → ลองใหม่ใน 3 วินาที; แท็บซ่อน → ไม่ทำ (ตามด้วยการ look เมื่อกลับมา)
- `useEffect` ขึ้นกับ **ค่า** ของ `who` ไม่ใช่ object (object ใหม่ทุก render ของ server → ต่อ socket ใหม่ทุกครั้งที่ refresh)
- ปิดทั้งชั้น socket ได้ด้วย `NEXT_PUBLIC_LIVE_REALTIME=0` (ต้อง build ใหม่) แล้วใช้ polling อย่างเดียว

### 3.4 ทางสำรอง: ลายนิ้วมือ (`/api/live`)

- `GET /api/live?w=notif,admin` คืน `{ t: "n3@2026-…|a2/0/1/4/0" }` — **ตัวเลขและ id เท่านั้น ไม่มีชื่อหรือข้อความ**
- ผู้ใช้ได้เฉพาะ part ของบทบาทที่ตนถือ (กรอง `keys` ตามบทบาทที่เซิร์ฟเวอร์รู้ ไม่เชื่อ query)
- `notif`: จำนวนแจ้งเตือนที่ยังไม่อ่าน + เวลาล่าสุด (ใช้ client ของผู้ใช้ → ผ่าน RLS); `tele`/`pharm`/`branch`/`admin`: นับแถวที่รอ (ฟังก์ชัน SQL เดียวสำหรับแอดมิน: `admin_queue_counts()`)
- client เทียบกับครั้งก่อน: ต่างกัน = `router.refresh()`; **ครั้งแรกเป็นแค่ baseline** (ไม่ refresh)
- ถ้ากำลังพิมพ์ จะคง baseline เดิมไว้แล้วถามใหม่เร็ว ๆ (ไม่ทิ้งการเปลี่ยนแปลง)
- ช้าลงเรื่อย ๆ เมื่อเงียบ (`nextDelay`: ×1 → ×2 หลัง 6 ครั้งที่ไม่เปลี่ยน → ×4 หลัง 18 ครั้ง, สูงสุด 60 วินาที), พักเมื่อแท็บซ่อน (ถามทุก 30 วินาที), ตื่นเมื่อ `visibilitychange` / `focus` / `online`
- 401 = ออกจากระบบแล้ว หยุดถาม

### 3.5 เพิ่ม "สถานะสด" ใหม่ในระบบ

1. trigger บนตารางที่หน้าจอแสดง → `live_ping('<topic>')` (เฉพาะเมื่อสถานะ/ค่าที่เกี่ยวเปลี่ยนจริง)
2. ถ้าเป็น topic ใหม่: เพิ่มใน `liveTopicsFor` (+ `LiveKey`/`liveConfigFor` ถ้าต้องมี fallback) และเพิ่มเงื่อนไขในนโยบาย `live_signals_listen`
3. เพิ่ม part ใน `/api/live` (ตัวเลข/ id ที่ทำให้ลายนิ้วมือเปลี่ยนเมื่อสถานะเปลี่ยน)
4. ถ้าเป็นเรื่องที่ผู้ใช้ต้องรู้อยู่แล้ว → แค่ส่งแจ้งเตือน (`notifyUser`) แล้วฝั่งผู้ใช้จะเห็นผ่าน `u:<user>` เอง ไม่ต้องทำข้อ 1–3
5. หน้าที่ห้าม refresh เอง (แชต, การถ่ายภาพ, ฟอร์มยาว) ใส่ใน `NO_REFRESH`
6. เทสใน `supabase/tests/live-signals.test.ts` (ping ถูก topic, การแก้ที่ไม่เกี่ยวไม่ ping)

## 4. กฎที่ห้ามละเมิด

1. **ping ห้ามมีข้อมูล** — แค่ "มีอะไรขยับ"; ข้อมูลจริงอ่านด้วยสิทธิ์ของผู้ใช้เองตอน refresh
2. **ห้ามให้ใครฟัง topic ที่ไม่เกี่ยวกับตน** — ตัดสินที่นโยบายฐานข้อมูล ไม่ใช่ที่ client
3. **การส่ง ping ห้ามทำให้การเขียนล้ม** (กลืน error) และต้องไม่ทำอะไรที่ไม่มี Realtime
4. ต้องมีทางสำรองเสมอ (socket อาจใช้ไม่ได้ในบางเครือข่ายหรือพร็อกซี) และการตามให้ทันเมื่อกลับมา
5. **client ของ socket ห้ามจัดการ session เอง** — ใช้ token จากเซิร์ฟเวอร์เท่านั้น
6. ห้าม refresh ขณะผู้ใช้พิมพ์หรือในหน้าที่มีงานค้างอยู่ในมือ (แชต, ถ่ายภาพ)
7. ฟังเฉพาะ topic ที่หน้านั้นต้องใช้ (โควตาการเชื่อมต่อ)
8. ลายนิ้วมือสำรองต้องเป็นตัวเลข/ id และกรองตามบทบาทที่เซิร์ฟเวอร์รู้

## 5. บทเรียนจากของจริง

| เกิดอะไร                                                  | สาเหตุราก                                                                                                             | แก้อย่างไร                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| แท็บที่เปิดทิ้งไว้กินคำขอ function และฐานข้อมูลตลอดเวลา   | polling ทุก 5–12 วินาทีต่อแท็บ                                                                                        | ให้ฐานข้อมูลส่ง ping (ฟังฟรีระหว่างเงียบ); polling เหลือเป็นสำรองและช้าลงเอง             |
| **ล็อกอินหลุดและ redirect วนไม่จบ** หลังเปิด socket       | client ของ socket รีเฟรช session เองในเบราว์เซอร์ แข่งกับเซิร์ฟเวอร์ → refresh token ถูกใช้สองครั้ง session ถูกยกเลิก | client ธรรมดาที่ปิด `persistSession`/`autoRefreshToken` + ขอ token จาก `/api/live/token` |
| เชื่อมต่อ socket ใหม่ทุกครั้งที่หน้า refresh              | `useEffect` ขึ้นกับ object `who` ที่ server สร้างใหม่ทุก render                                                       | ขึ้นกับค่าใน object ไม่ใช่ตัว object                                                     |
| หน้าฟอร์มที่กำลังกรอกถูกโหลดใหม่ ข้อมูลที่พิมพ์หาย        | refresh ทันทีที่ได้ ping                                                                                              | `typing()` → รอแล้วลองใหม่; หน้าแชต/ถ่ายภาพ `refresh:false`                              |
| ไม่ได้ ping เลยตอนแท็บอยู่เบื้องหลังแล้วกลับมา ข้อมูลเก่า | แท็บซ่อนไม่ refresh                                                                                                   | `visibilitychange`/`focus`/`online` → ถามลายนิ้วมือหนึ่งครั้งเพื่อตามให้ทัน              |
| socket ต่อไม่ได้บางเครื่อง/เครือข่าย                      | พร็อกซีหรือไฟร์วอลล์บล็อก WebSocket                                                                                   | ทางสำรอง polling อัตโนมัติ (ผู้ใช้ไม่รู้สึก แค่ช้าลงเป็นวินาที)                          |
| นโยบายผู้ฟังสร้างไม่ได้ในฐานข้อมูลทดสอบ                   | ไม่มี schema `realtime`                                                                                               | สร้างนโยบายเฉพาะเมื่อมี `realtime.messages`; เทสด้วย schema จำลองที่บันทึก topic         |
| ping ถี่เกินจากการแก้ฟิลด์ที่ไม่เกี่ยว                    | trigger ปลุกทุก UPDATE                                                                                                | `AFTER UPDATE OF <คอลัมน์> … WHEN (old IS DISTINCT FROM new)`                            |

## 6. ลอกไปใช้ในระบบอื่นอย่างไร

**ถ้าใช้ Supabase** (เหมือน RooSuk): ทำตาม §3 ได้ตรง ๆ

1. migration: `live_ping`, ฟังก์ชันตรวจบทบาท, trigger ต่อตาราง, นโยบาย `realtime.messages` (เฉพาะที่มี Realtime)
2. `watch.ts`: เส้นทาง → topic / interval / refresh; ฟังก์ชัน pure ทดสอบได้
3. `LiveSync` ใน layout หลัก + route token + route ลายนิ้วมือสำรอง
4. layout ส่ง `who` (บทบาทและสาขา) จากบริบทผู้ใช้ที่อ่านครั้งเดียว
5. เปิด Realtime ในโปรเจกต์ และทดสอบ: เปิดสองหน้าต่าง → เปลี่ยนสถานะ → อีกหน้าต่างเปลี่ยนเองภายในไม่กี่วินาที; ปิด socket (`NEXT_PUBLIC_LIVE_REALTIME=0`) → ยังเปลี่ยนด้วยทางสำรอง

**ถ้าไม่ใช้ Supabase** — แนวคิดเดียวกัน แทนแต่ละชิ้นด้วย:

| ชิ้นส่วน         | ทางเลือก                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ผู้ส่ง ping      | Postgres `LISTEN/NOTIFY` + เซิร์ฟเวอร์ที่ถือ WebSocket/SSE, Redis pub/sub, Pusher/Ably, SNS, หรือเรียกจาก service layer หลังบันทึกสำเร็จ |
| ช่องส่ง          | **SSE** (ง่ายสุด ทางเดียว ผ่านพร็อกซีส่วนใหญ่) หรือ WebSocket                                                                            |
| ตรวจสิทธิ์ผู้ฟัง | ตอน subscribe ฝั่งเซิร์ฟเวอร์ (topic ต้องตรงกับบทบาท/id ของ session) — ห้ามให้ client ระบุ topic เองโดยไม่ตรวจ                           |
| ทางสำรอง         | endpoint ลายนิ้วมือ (`/api/live`) แบบเดียวกัน                                                                                            |
| ฝั่ง client      | ปลุกให้โหลดข้อมูลใหม่ (refetch / invalidate query / `router.refresh`) ไม่ส่งข้อมูลมากับ ping                                             |

**ข้อควรตัดสินใจก่อนลอก**

- คนที่ต้อง "เห็นทันที" คือใคร และกี่คนต่อหน้า → ตั้ง topic ให้ละเอียดพอ (ต่อคน/ต่อสาขา/ต่อทีม) แต่ไม่ละเอียดจนเปิด channel นับร้อย
- ปริมาณการเชื่อมต่อพร้อมกัน vs โควตาของผู้ให้บริการ (ต่อแท็บ) — แผนฟรีของ Supabase 200 การเชื่อมต่อ
- ถ้าต้องส่งข้อมูลจริงในสัญญาณ (เช่น แชตสด) นั่นเป็นอีกแบบ: ต้องกรองสิทธิ์ที่ข้อความแต่ละอัน ไม่ใช่ ping เปล่า
- เทส: unit ของ `liveTopicsFor`/`liveConfigFor`/`nextDelay`/`parseLiveKeys`; ฐานข้อมูล: trigger ส่งถูก topic และการแก้ที่ไม่เกี่ยวไม่ส่ง (ใช้ schema จำลองที่บันทึก topic); end-to-end: สองหน้าต่าง + กรณีปิด socket
