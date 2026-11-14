# Knowledge: ผูกบัญชี LINE ของผู้ใช้เพื่อรับการแจ้งเตือน (จากระบบ ThaiPass e-VOA)

> เขียนเพื่อนำไปใช้ในโครงการอื่น (Next.js + Supabase) — ทุกอย่างอ้างอิงโค้ดจริงที่ใช้งานอยู่ ไม่มีคีย์/โทเคนในเอกสารนี้ (มีแต่ **ชื่อ** ตัวแปรสภาพแวดล้อม)
> โค้ดอ้างอิง: `src/components/LineConnect.tsx` · `src/app/actions/messaging.ts` · `src/app/api/line/webhook/route.ts`
> · `src/lib/messaging/{service,line,flex,settings}.ts` · `src/config/line-colors.ts` · `src/app/account/notifications/page.tsx` · `src/app/admin/messaging/page.tsx`
> · ตาราง `supabase/migrations/20261110000200_messaging.sql` · ตัวจำลอง `tools/mock-partners/server.mjs` · เทสต์ `src/lib/messaging/*.test.ts`, `tests-live/phase4.live.test.ts`
> เอกสารคู่กัน: [LINE-NOTIFICATIONS-KNOWLEDGE.md](./LINE-NOTIFICATIONS-KNOWLEDGE.md) (คิว/โควตา/retry ของ RooSuk) · [LINE-FLEX-CARD-KNOWLEDGE.md](./LINE-FLEX-CARD-KNOWLEDGE.md) (การ์ด) · [evoa/11-LINE-FLEX-NOTES.md](./evoa/11-LINE-FLEX-NOTES.md) (จุดที่ ThaiPass ต่างจากต้นแบบ)

## สารบัญ
1. ปัญหาและแนวคิด
2. เลือกวิธีผูกบัญชี: 3 ทางเลือก และทำไมเลือก "รหัสครั้งเดียวส่งเข้า LINE OA"
3. ภาพรวมการไหล (sequence)
4. ตั้งค่าฝั่ง LINE และฝั่งระบบ (ทีละขั้น)
5. ข้อมูล (ตาราง, RLS, สถานะ)
6. ฝั่งเซิร์ฟเวอร์: สร้างรหัส ผูกบัญชี ยกเลิก
7. Webhook: ความปลอดภัยและการตอบกลับ
8. หน้าจอผู้ใช้ (UX): 4 ขั้นตอนและการอัปเดตอัตโนมัติ
9. ส่งแจ้งเตือนหลังผูกแล้ว: ภาษา โควตา การ์ด Flex fallback ข้อผิดพลาด
10. หน้าแอดมิน
11. การทดสอบ (unit, ตัวจำลอง, live, อุปกรณ์จริง)
12. กับดักและข้อควรระวัง
13. ช่องว่างที่ระบบนี้ยังไม่ได้ทำ (แนะนำให้ทำในโครงการใหม่)
14. เช็กลิสต์นำไปใช้ซ้ำ + โค้ดโครงขั้นต่ำ

---

## 1. ปัญหาและแนวคิด

- อยากส่งการแจ้งเตือนถึงผู้ใช้ทาง LINE (เช่น อนุมัติแล้ว ชำระเงินแล้ว ต้องแก้ไข) แต่ **ระบบเรารู้จักผู้ใช้ด้วยบัญชีของเว็บ (อีเมล/รหัสผ่าน/Google)** ส่วน LINE รู้จักด้วย `userId` ของ LINE ที่ **เราไม่มีทางรู้เอง**
- การ push ข้อความหาใคร ต้องมี `userId` ของคนนั้นภายใต้ Messaging API channel ของเรา และคนนั้นต้อง **เป็นเพื่อน (add friend)** กับ LINE Official Account (OA) ของเรา
- ดังนั้น "การผูกบัญชี" = **พิสูจน์ว่า LINE userId ตัวนี้ คือผู้ใช้เว็บคนนี้** แล้วเก็บคู่ `ผู้ใช้เว็บ ↔ LINE userId`
- หลักคิดของระบบนี้: **ผู้ใช้เป็นฝ่ายส่งรหัสครั้งเดียวมาหา OA** → webhook ที่เซ็นลายเซ็นแล้วบอกเราทั้ง "รหัส" และ "LINE userId ของผู้ส่ง" ในเหตุการณ์เดียว จึงผูกได้โดยไม่ต้องให้ผู้ใช้ล็อกอิน LINE และไม่ต้องใช้ LIFF/LINE Login

## 2. เลือกวิธีผูกบัญชี

| วิธี | ทำงานอย่างไร | ข้อดี | ข้อเสีย |
| --- | --- | --- | --- |
| **A. รหัสครั้งเดียวส่งเข้า OA (ที่ใช้อยู่)** | เว็บสร้างรหัส 8 ตัว → ผู้ใช้ add OA แล้วพิมพ์/แตะส่งรหัสในแชต → webhook จับคู่ | ไม่ต้องมี LINE Login/LIFF/ช่องทาง OAuth เพิ่ม · ผูกกับ "friend" ในขั้นเดียว (add friend + ยืนยันตัวตน) · ใช้ได้กับบัญชีเว็บทุกชนิด · ฝั่งเซิร์ฟเวอร์ตรวจได้ทั้งหมด | ผู้ใช้ต้องสลับแอป (เว็บ → LINE → เว็บ) · ต้องมือถือที่ติดตั้ง LINE · ต้องออกแบบกันเดารหัส |
| B. LINE Login (OAuth/OpenID) | ผู้ใช้กด "เชื่อมต่อ LINE" → ล็อกอิน LINE → ได้ `sub` | แตะครั้งเดียว ไม่ต้องคัดลอกรหัส | ต้องสร้าง LINE Login channel เพิ่ม · `sub` ใช้ push ได้เมื่ออยู่ **provider เดียวกับ** Messaging API channel เท่านั้น · ต้องขอ `bot_prompt` เพื่อให้ add friend · ล็อกอินพลาดบ่อยบนเบราว์เซอร์ในแอป |
| C. LIFF | หน้าเว็บเปิดในแอป LINE ได้ userId ผ่าน `liff.getProfile()` | ลื่นที่สุดถ้าผู้ใช้อยู่ใน LINE อยู่แล้ว | ต้องมี LIFF app · ผู้ใช้ส่วนใหญ่เข้าเว็บจากเบราว์เซอร์ปกติ · ต้องพิสูจน์ ID token ฝั่งเซิร์ฟเวอร์ |

เลือก A เพราะผู้ใช้เป็นนักเดินทางต่างชาติหลายภาษา เข้าเว็บจากเบราว์เซอร์ปกติ และบัญชีเว็บมีหลายแบบ (Google/อีเมล/LINE-SSO) — วิธี A ไม่ผูกกับวิธีล็อกอินเลย. ถ้าโครงการใหม่ผู้ใช้อยู่ใน LINE เป็นหลัก ให้พิจารณา C ก่อน

## 3. ภาพรวมการไหล

```
ผู้ใช้ (เว็บ, ล็อกอินแล้ว)        เซิร์ฟเวอร์ของเรา                 LINE Platform            ผู้ใช้ (แอป LINE)
        │  กด "เชื่อมต่อ LINE"        │                                   │                        │
        ├──────────────────────────▶ │ startLineLink(userId)             │                        │
        │                            │  • สร้างรหัส 8 ตัว (สุ่มจาก crypto) │                        │
        │                            │  • upsert notification_channels   │                        │
        │                            │    status=pending, code_hash=HMAC │                        │
        │ ◀── {code, basicId} ───────┤    หมดอายุ 30 นาที                 │                        │
        │ แสดง 4 ขั้นตอน + รหัส       │                                   │                        │
        │ (poll router.refresh ทุก 4 วิ)│                                  │                        │
        │                            │                                   │ ◀── add friend ────────┤ (ลิงก์ line.me/R/ti/p/@id)
        │                            │                                   │ ◀── ข้อความ "ABCD2345" ─┤ (ลิงก์ line.me/R/oaMessage/@id/?code)
        │                            │ ◀── POST /api/line/webhook ───────┤                        │
        │                            │     X-Line-Signature (HMAC)       │                        │
        │                            │  verify → rate-limit → regex      │                        │
        │                            │  bindLine(code, source.userId)    │                        │
        │                            │  update … where status='pending'  │                        │
        │                            │    → active, address=LINE userId  │                        │
        │                            │ ── reply "เชื่อมต่อแล้ว" (ภาษาผู้ใช้) ─▶ ────────────────────▶ │
        │ refresh รอบถัดไปเห็น "✓ เชื่อมต่อแล้ว"                           │                        │
```

หลังผูก: ทุกการแจ้งเตือนผ่านตัวส่งกลางตัวเดียว (`notifyUser` → `sendToChannels`) → push การ์ด Flex ไปที่ `address`

## 4. ตั้งค่า

### 4.1 ฝั่ง LINE (ทำครั้งเดียวต่อโครงการ/สภาพแวดล้อม)
1. สร้าง **LINE Official Account** (ได้ **Basic ID** รูปแบบ `@xxxxxxx` — ใช้ในลิงก์ add friend/ส่งข้อความ)
2. ใน LINE Official Account Manager → Settings → **Messaging API** → Enable (เลือก/สร้าง Provider) — จะได้ Messaging API channel ใน LINE Developers Console
3. ใน LINE Developers Console → channel นั้น:
   - คัดลอก **Channel secret** (ใช้ตรวจลายเซ็น webhook)
   - ออก **Channel access token (long-lived)** (ใช้เรียก push/reply)
   - ตั้ง **Webhook URL** = `https://<โดเมนของเรา>/api/line/webhook` แล้วเปิด **Use webhook**
   - กด **Verify** (ต้องได้ 200 — ดู §7: ตอบ 200 เมื่อลายเซ็นถูกแม้ events ว่าง)
4. ใน Official Account Manager → Response settings: **ปิด Auto-reply messages** และ **Greeting message** (ถ้าเปิดไว้ ผู้ใช้จะได้ข้อความซ้อนกับที่เราตอบ) และเลือกโหมด Chat/Webhook ตามที่ต้องการ
5. ทดสอบด้วยบัญชีส่วนตัว: add OA เป็นเพื่อน แล้วส่งข้อความ — ต้องเห็น request เข้า log ของ webhook

### 4.2 ฝั่งระบบ (ชื่อตัวแปร — ค่าเก็บใน Vercel/ตัวจัดการความลับ ห้ามใส่ในไฟล์/คอมมิต)
| ตัวแปร | ใช้ทำอะไร |
| --- | --- |
| `LINE_CHANNEL_SECRET` | ตรวจ `X-Line-Signature` (server เท่านั้น) |
| `LINE_CHANNEL_ACCESS_TOKEN` | เรียก push/reply (server เท่านั้น) |
| `LINE_BASIC_ID` | Basic ID ของ OA เช่น `@xxxxxxx` (ไม่ลับ — แสดงให้ผู้ใช้เห็นอยู่แล้ว) |
| `LINE_API_URL` | (ไม่บังคับ) ค่าเริ่มต้น `https://api.line.me` — ชี้ไปตัวจำลองเวลาทดสอบ |

- **ไม่มี `NEXT_PUBLIC_`** นำหน้าตัวใดเลย
- `lineConfigured()` = ครบทั้ง 3 ตัว (token, secret, basic id) → ถ้าไม่ครบ หน้าบัญชีจะแสดง "ช่องทางนี้ยังไม่เปิด" แทนปุ่มเชื่อมต่อ (ไม่พัง)
- เปิด/ปิด และเพดานข้อความต่อเดือนตั้งที่หน้าแอดมิน (`platform_settings.messaging`: `line_enabled`, `line_quota`) — อ่านไม่ได้ให้ใช้ค่าเริ่มต้นในโค้ด (กฎ fail-open)

## 5. ข้อมูล

```sql
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('line','whatsapp')),
  address text,                    -- LINE userId (หรือเบอร์ WhatsApp) — null ระหว่างรอผูก
  status text not null default 'pending' check (status in ('pending','active','stopped')),
  code_hash text,                  -- HMAC ของรหัส ไม่เก็บรหัสจริง
  code_expires_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (owner_id, channel)       -- 1 ผู้ใช้ 1 แถวต่อช่องทาง: เริ่มใหม่ = เขียนทับแถวเดิม
);
create index on public.notification_channels (address) where channel = 'line';
alter table public.notification_channels enable row level security;   -- ไม่มี policy = เบราว์เซอร์อ่านไม่ได้เลย (เซิร์ฟเวอร์ใช้ service role)

create table if not exists public.message_log (          -- ใช้นับโควตาและแสดงข้อผิดพลาด
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade,
  channel text not null, kind text,
  status text not null check (status in ('sent','failed')), error text
);
create index on public.message_log (channel, at desc);
alter table public.message_log enable row level security;  -- แอดมินอ่านได้ (policy select ด้วย is_admin())
```

### สถานะของแถว
| status | ความหมาย | ออกจากสถานะนี้เมื่อ |
| --- | --- | --- |
| `pending` | ออกรหัสแล้ว รอผู้ใช้ส่งรหัสเข้า OA (`address` ยังว่าง) | ผูกสำเร็จ → `active` · กด "ขอรหัสใหม่" → `pending` (รหัสใหม่ทับ) · หมดอายุ (ตรวจตอนใช้) |
| `active` | ผูกแล้ว มี `address` = LINE userId ส่งแจ้งเตือนได้ | ผู้ใช้ unfollow/บล็อก → `stopped` · กดยกเลิกการเชื่อมต่อ → ลบแถว |
| `stopped` | ส่งไม่ได้ (unfollow หรือ LINE ตอบ error ถาวร) · `last_error` บอกสาเหตุ | ผู้ใช้เริ่มเชื่อมต่อใหม่ (ขอรหัสใหม่) |

- ผู้ใช้เห็นอะไร: `channelsOf()` ส่งเฉพาะ `status`, `masked` ("LINE ✓" — **ไม่โชว์ userId**), `last_error`, `waiting`, วันหมดอายุ — ไม่ส่ง `code_hash` ออกนอกเซิร์ฟเวอร์
- ลบผู้ใช้ → `on delete cascade` ลบแถวตามอัตโนมัติ (PDPA)

## 6. ฝั่งเซิร์ฟเวอร์ (`src/lib/messaging/service.ts`)

### 6.1 `startLineLink(userId)` — ออกรหัส
- เงื่อนไข: ตั้งค่าครบ + แอดมินเปิดช่องทางนี้ ไม่งั้นคืน `err_channel_unavailable`
- รหัส: 8 ตัวจากชุด `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (**ไม่มี 0/O/1/I** เพราะผู้ใช้อ่านจากหน้าจอแล้วพิมพ์ในแชต) สุ่มด้วย `crypto.randomInt` (ไม่ใช้ `Math.random`) → ~40 บิต
- เก็บ `code_hash = HMAC-SHA256(คีย์ลับของเรา, รหัส)` — **ไม่เก็บรหัสจริง** (ถ้าฐานข้อมูลรั่ว ก็ใช้รหัสไม่ได้) · หมดอายุ 30 นาที · `attempts=0`
- ใช้ `upsert … onConflict (owner_id, channel)` แล้ว `.select("id")` ตรวจว่าได้ **1 แถว** — เขียนไม่ติดแถวไม่ถือว่าสำเร็จ (กฎ "write ที่ไม่ match แถวไม่ใช่ success")
- เริ่มใหม่ = รหัสเก่าตายทันที (ทับแถวเดียวกัน)
- คืน `{ code, basicId }` — รหัสจริงแสดงบนหน้าจอ **ครั้งเดียว** (เก็บในหน่วยความจำของ component) ถ้ารีเฟรชหน้าแล้วหาย ให้กด "ขอรหัสใหม่"

### 6.2 `bindLine(code, lineUserId)` — ผูก (เรียกจาก webhook เท่านั้น)
1. normalize เป็นตัวพิมพ์ใหญ่ ตรวจ `^[A-Z2-9]{8}$` และมี `lineUserId`
2. ค้นแถว `channel='line' AND status='pending' AND code_hash=HMAC(code)` — **ค้นด้วย hash** (ไม่ต้องรู้ว่าเป็นของใคร: LINE ไม่ได้บอกเราว่าผู้ส่งคือผู้ใช้เว็บคนไหน รหัสคือสิ่งเดียวที่โยงได้)
3. ตรวจยังไม่หมดอายุ และ `attempts < 5`
4. `update … set address=lineUserId, status='active', code_hash=null, code_expires_at=null, verified_at=now() where id=… and status='pending'` แล้ว `.select("id")` ต้องได้ 1 แถว — **เงื่อนไข `status='pending'` ในประโยค update ทำให้ใช้รหัสได้ครั้งเดียว** แม้มีสองคำขอมาพร้อมกัน (compare-and-set)
5. เขียน audit `channel.link` (ไม่ใส่ userId ของ LINE ใน audit) · คืน `{ ok, ownerId }` ให้ webhook ใช้ตอบกลับในภาษาของเจ้าของ

### 6.3 `lineUnfollowed(lineUserId)`
เหตุการณ์ `unfollow` (ผู้ใช้บล็อก/ลบ OA) → ตั้ง `status='stopped'`, `last_error='unfollowed'` — ไม่ลบแถว เพื่อให้หน้าบัญชีบอกได้ว่า "หยุดส่งเพราะ…" และผู้ใช้เริ่มใหม่ได้

### 6.4 `disconnectChannel(userId, channel)`
ลบแถวของผู้ใช้เอง (`.select("id")` นับแถว) + audit `channel.unlink` — คืน false ถ้าไม่มีอะไรให้ลบ (หน้าจอแสดง `err_not_found`)

## 7. Webhook (`POST /api/line/webhook`)

ลำดับที่ต้องทำ **ตามนี้เสมอ**:

1. อ่าน body เป็น **ข้อความดิบ** (`await req.text()`) — **ห้าม `req.json()` ก่อนตรวจลายเซ็น** เพราะลายเซ็นคำนวณจากไบต์ดิบ (ช่องว่าง/ลำดับ key ต่างก็ไม่ตรง)
2. จำกัดขนาด ≤ 200 KB และตรวจ `X-Line-Signature` = `base64(HMAC-SHA256(channelSecret, rawBody))` ด้วย `timingSafeEqual` (เทียบเวลาคงที่; ตรวจความยาวก่อน) — ไม่ผ่าน/ไม่มี secret → **401** และไม่อ่านอะไรต่อ
3. parse JSON (พัง → 400) · ประมวลผลไม่เกิน 20 events ต่อคำขอ
4. ต่อ event: ข้ามถ้าไม่มี `source.userId`
   - `unfollow` → `lineUnfollowed`
   - ไม่ใช่ข้อความตัวอักษร หรือไม่มี `replyToken` → ข้าม
   - **rate-limit ต่อ LINE userId** `line:bind:<uid>` 10 ครั้ง/10 นาที — เกินแล้วเงียบ ไม่ตอบ (ชะลอการเดารหัสจากบัญชี LINE เดียว)
   - จับรหัสด้วย `^(?:LINK\s+)?([A-Z2-9]{8})$` หลัง `trim().toUpperCase()` (รับทั้ง `ABCD2345` และ `link abcd2345`)
   - ไม่ตรงรูปแบบ → ตอบข้อความช่วยเหลือ (ต่อกันทุกภาษา เพราะเรายังไม่รู้ว่าผู้ส่งเป็นใคร)
   - ตรงรูปแบบ → `bindLine` → สำเร็จ: ตอบ "เชื่อมต่อแล้ว" **ในภาษาโปรไฟล์ของเจ้าของ** (`profiles.lang`, ไม่รู้ใช้ `en`) · ไม่สำเร็จ: ตอบ "รหัสไม่ถูกต้องหรือหมดอายุ" (ทุกภาษา, ไม่บอกว่าผิดเพราะอะไร — ไม่ให้ผู้เดารู้ว่ารหัสมีอยู่จริงแต่หมดอายุ)
5. ตอบ `200 { ok: true }` เสมอเมื่อลายเซ็นถูก (LINE จะ retry/ปิด webhook ถ้าตอบ error บ่อย)

ข้อควรรู้:
- `lineReply` ใช้ `replyToken` (ใช้ได้ครั้งเดียว และอายุสั้น) และ **กลืน error** — การผูกสำเร็จไปแล้ว การตอบกลับไม่ถึงไม่ควรทำให้ทั้งคำขอล้ม · ตัดข้อความที่ 900 ตัวอักษร
- reply ไม่นับโควตา push ของ LINE (ต่างจาก push) — ใช้ reply สำหรับตอบโต้ในแชต push สำหรับแจ้งเตือน
- ประมวลผลแบบอนุกรมในคำขอเดียว: ตอบภายในไม่กี่วินาที (ไม่มีงานหนัก/ไม่รอ push)

## 8. หน้าจอผู้ใช้ (UX)

หน้า `/account/notifications` (ต้องล็อกอิน) มีกล่อง LINE ที่มี 3 สถานะ:
- **ยังไม่เปิดช่องทาง** (`!lineConfigured || !line_enabled`) → ข้อความ "ช่องทางนี้ยังไม่เปิด"
- **active** → "✓ เชื่อมต่อแล้ว LINE ✓" + ปุ่มยกเลิกการเชื่อมต่อ (`SubmitButton` ghost)
- **อื่นๆ** → คอมโพเนนต์ `LineConnect` (ปุ่ม "เชื่อมต่อ LINE" หรือ "ขอรหัสใหม่" ถ้ากำลังรอ/ขอแล้ว) · `stopped` แสดงสาเหตุจาก `last_error` ด้วย

`LineConnect` — **4 ขั้นตอนเป็นเลขลำดับ** (`<ol aria-label>`, วงกลมเลขเป็นการตกแต่ง `aria-hidden`):
1. **คัดลอกรหัส** — รหัสตัวใหญ่ monospace ระยะห่างตัวอักษรกว้าง (`select-all`, `aria-label`) + ปุ่ม "คัดลอก" (`navigator.clipboard` ถ้าไม่ได้ใช้ `textarea` + `execCommand` สำรอง → เปลี่ยนเป็น "✓ คัดลอกแล้ว" 2.5 วิ) · บอก "ใช้ได้ 30 นาที"
2. **เพิ่มเพื่อน** — ปุ่ม `https://line.me/R/ti/p/<basicId ที่ encode>` (เปิดหน้า add friend ของ OA ในแอป LINE)
3. **ส่งรหัสใน LINE** — ปุ่ม `https://line.me/R/oaMessage/<basicId>/?<รหัส>` เปิดแชตกับ OA โดย **พิมพ์รหัสไว้ให้แล้ว แตะ Send ได้เลย** · ข้อความช่วย: ถ้ารหัสไม่ขึ้นให้วางที่คัดลอกไว้
4. **รอที่หน้านี้** — บอกว่าหน้าจะเปลี่ยนเป็น "เชื่อมต่อแล้ว" เอง และต้องติดตั้ง LINE บนเครื่องนี้ (ถ้าใช้คอมพิวเตอร์ให้เปิดหน้านี้บนมือถือ)

พฤติกรรมสำคัญ:
- ขณะมีรหัสบนหน้าจอ **poll `router.refresh()` ทุก 4 วินาที** จนครบ 30 นาที (server component อ่านสถานะใหม่ → เปลี่ยนเป็นเชื่อมต่อแล้วเอง; ไม่ต้องใช้ websocket) · เลิก poll เมื่อ component ถูกถอดออก
- ทุกปุ่มมีสปินเนอร์ (`AsyncButton`, `OutLink`) ตามกฎของโครงการ · ข้อความผิดพลาดมาเป็นรหัส `err_*` แล้ว `errorText()` แปลตามภาษา · ข้อความทั้งหมดผ่านพจนานุกรม (`chat_line_*`) ทุกภาษา
- ขอรหัสบ่อยเกิน → `err_rate_limited` (`chan:line:<user>` 10 ครั้ง/ชม.)
- ปุ่ม "ส่งการแจ้งเตือนทดสอบ" (`testChannelsAction`, 5 ครั้ง/ชม.) เรียก `notifyUser` ให้ผู้ใช้ตรวจว่าการ์ดมาถึงจริง

## 9. ส่งแจ้งเตือนหลังผูก (`sendToChannels`)

- **จุดส่งเดียว**: ฟีเจอร์ไม่เรียก LINE เอง → เรียก `notifyUser({userId,title,body,link,kind,fields,note,dedupeKey})` ซึ่งเขียนกล่องแจ้งเตือนในแอป + อีเมล + LINE + WhatsApp + Web Push ภายใน try/catch — **ไม่เคย throw ใส่ธุรกิจหลัก**
- อ่านแถว `status='active'` ของผู้ใช้ → ตรวจแอดมินเปิดช่องทาง + ตั้งค่าครบ → ตรวจ **โควตารายเดือน** (นับ `message_log` ที่ `status='sent'` ของเดือนนี้ — นับเฉพาะที่ส่งจริง) เกินแล้วข้าม (การแจ้งเตือนในแอป/อีเมลยังไป)
- **ภาษา**: ข้อความในการ์ด (ปุ่ม "เปิดดู" ฯลฯ) ใช้ `profiles.lang` ของผู้รับ — เป็นภาษาที่ผู้ใช้เลือกในเว็บ ไม่ใช่ภาษาของแอป LINE
- **การ์ด Flex** (`buildFlex`, ฟังก์ชันบริสุทธิ์ ไม่เรียกเครือข่าย): หัวสีตามชนิดเหตุการณ์ (`kind` → `styleOf`: info/success/warning/danger/money/refund/extra/staff; สีเป็น hex อยู่ไฟล์เดียว `src/config/line-colors.ts` ทุกสีตัวหนังสือขาวผ่านคอนทราสต์ 4.5:1), แถว "ป้าย | ค่า" (ไม่เกิน 8), หมายเหตุ, ปุ่มเดียวเปิดเว็บ
  - ตัดทุกข้อความด้วย "…" ตามขีดจำกัด (title 100, label 24, value 120, note 160, summary 300, altText 400, ปุ่ม 20) — **LINE ปฏิเสธทั้งข้อความ** ถ้าช่องใดเกิน
  - `altText` = "หัวเรื่อง — สรุป · ป้าย ค่า …" (สิ่งที่เห็นบนหน้าจอล็อก/รายการแชต)
  - ปุ่ม: `appOpenUrl` = เว็บของเรา + path ภายในที่ผ่าน `safeHref` (ขึ้นต้น `/` ไม่ใช่ `//`, ≤300, ไม่มี `\`/ตัวควบคุม) + `?openExternalBrowser=1` → เปิดในเบราว์เซอร์ของเครื่อง (เบราว์เซอร์ในแอป LINE ขอล็อกอินใหม่) — ไม่ใช้ LIFF
  - **ไม่ใส่ข้อมูลอ่อนไหวบนการ์ด** (ขึ้นหน้าจอล็อก): เลขอ้างอิง/สถานะ/จำนวนเงินได้ แต่ "เหตุผลที่ถูกปฏิเสธ/ต้องแก้อะไร" ไม่ใส่
- **Fallback เป็นข้อความธรรมดา**: ถ้า push การ์ดได้ HTTP 400 (อาจแปลว่ารูปแบบผิด) → ส่งข้อความตัวอักษรของเหตุการณ์เดิมอีกครั้งทันที และ **ไม่หยุดช่องทาง** — ปัญหาการจัดรูปแบบจะไม่ทำให้ข้อความหายหรือผู้ใช้ถูกตัดการเชื่อมต่อ
- **บันทึกผล**: ทุกครั้งเขียน `message_log` (sent/failed + error) และอัปเดต `notification_channels.last_error`; **error ถาวร** (HTTP 400/403 จากการ push ข้อความตัวอักษร = ไม่ได้เป็นเพื่อน/ถูกบล็อก) → `status='stopped'` เพื่อไม่ยิงซ้ำ; error ชั่วคราว (เครือข่าย/5xx) แค่บันทึก ครั้งหน้าลองใหม่
- timeout 10 วินาทีต่อการเรียก LINE (`AbortSignal.timeout`) · ตัดข้อความ push ที่ 4,900 ตัวอักษร (ขีดของ LINE 5,000)

## 10. หน้าแอดมิน (`/admin/messaging`)
- สวิตช์เปิด/ปิดช่องทาง LINE + เพดานข้อความต่อเดือน (ค่าเริ่มต้น 1000) พร้อมตัวเลข "ส่งไปแล้วเดือนนี้" และ "ตั้งค่าครบหรือยัง"
- แสดง Webhook URL ของระบบให้คัดลอกไปใส่ใน LINE Console
- ต้องเรียก `requireAdminPage()` ที่หน้า และ `requireAdminAction()` บรรทัดแรกของ action ที่บันทึก — การซ่อนเมนูไม่ใช่การควบคุมสิทธิ์

## 11. การทดสอบ

| ชั้น | อะไร | ไฟล์ |
| --- | --- | --- |
| Unit | ลายเซ็นถูก/ผิด (body เปลี่ยน, secret อื่น, ไม่มี header, ความยาวต่าง) · ค่าตั้งแอดมิน (ค่าเริ่มต้น/จำกัดช่วง) · การ์ด (สีตามชนิด, ตัดความยาว, altText, ปุ่ม, path ปลอดภัย) | `messaging.test.ts`, `flex.test.ts` |
| ตัวจำลอง LINE | `tools/mock-partners` จำลอง `/line/v2/bot/message/push` และ `/reply`: ไม่มี token → 401, ผู้รับ `…BLOCKED` → 403, ผู้รับ `…FLEXFAIL` → 400 (ทดสอบ fallback), ตรวจขีดจำกัดของ Flex แบบที่ LINE ตรวจ, เก็บทุกข้อความที่ "ส่ง" ไว้ให้เทสต์อ่านที่ `/__admin/state` | `server.mjs`, `mock.test.mjs` |
| Live (Supabase จริง + ตัวจำลอง) | `startLineLink` → รหัส 8 ตัวถูกชุดอักขระ · ใน DB เก็บ hash ไม่ใช่รหัส · webhook ลายเซ็นผิด → 401 · ข้อความทั่วไป → ได้ข้อความช่วยเหลือและยัง `pending` · `link <รหัสตัวเล็ก>` → `active` + `address` ถูก + ตอบ "เชื่อมต่อแล้ว" · รหัสที่ใช้แล้วใช้ซ้ำไม่ได้ · รหัสหมดอายุ/ `attempts≥5` ผูกไม่ได้ | `tests-live/phase4.live.test.ts` |
| อุปกรณ์จริง (ยังต้องทำ) | add OA จริง, แตะลิงก์ `oaMessage` ว่ารหัสถูกพิมพ์ให้, ได้ข้อความตอบ, ได้การ์ดจริงบน iOS/Android, ปุ่มเปิดในเบราว์เซอร์เครื่อง, ภาษาอื่น (ไทย/จีน/อาหรับ ฯลฯ) แสดงถูก, unfollow แล้วสถานะเป็น stopped | — |

หลักการ: **ทดสอบกับตัวจำลองก่อน** แล้วค่อยใช้คีย์จริง; ผู้ใช้ทดสอบที่สร้างต้องลบในรันเดียวกัน

## 12. กับดักและข้อควรระวัง

1. **ลายเซ็นต้องคำนวณจากไบต์ดิบ** — framework ที่ parse JSON ให้ก่อนจะทำให้ตรวจไม่ผ่าน (ใน Next.js ใช้ `req.text()`)
2. **`userId` ของ LINE ผูกกับ Provider** — ผู้ใช้คนเดียวกันมี userId ต่างกันถ้าคนละ Provider; ย้าย OA/สร้าง channel ใหม่คนละ Provider = ต้องให้ผู้ใช้ผูกใหม่ทั้งหมด วางแผนตั้งแต่เริ่ม
3. **ผู้รับต้องเป็นเพื่อนอยู่** — บล็อก/ลบเพื่อน → push คืน 400/403; จึงต้องรับ `unfollow` และตั้ง `stopped` · ผู้ใช้กลับมาเป็นเพื่อนเอง (refollow) แล้วระบบ **ไม่รู้** — ต้องให้เขากดเชื่อมต่อใหม่ (ขอรหัสใหม่)
4. **Auto-reply / Greeting ของ OA ต้องปิด** ไม่งั้นผู้ใช้เห็นข้อความตอบซ้อนสองชุด
5. **Reply token ใช้ได้ครั้งเดียว/หมดอายุเร็ว** — ตอบทันทีใน request เดียวกัน ถ้าต้องส่งทีหลังใช้ push
6. **`@` ใน Basic ID**: ลิงก์ใช้ `encodeURIComponent` (`@abc` → `%40abc`) ทั้ง add friend และ oaMessage — ลิงก์นี้ยังต้องยืนยันบนเครื่องจริงทั้ง iOS/Android และทุกเวอร์ชันของแอป LINE
7. **ข้อความที่แนบมากับ `oaMessage` อาจไม่ขึ้น** (เวอร์ชันแอป/ผู้ใช้ยังไม่เป็นเพื่อน) → UI บอกให้ "วางรหัสที่คัดลอกไว้" เสมอ
8. **Webhook ต้องเร็ว** — อย่ารอ push หรืองานหนักใน request; ตอบ 200 เสมอเมื่อลายเซ็นถูก
9. **ข้อความตอบกลับตอนรหัสผิด** อย่าเฉลยสาเหตุ (หมดอายุ/ไม่มี/ใช้แล้ว ตอบเหมือนกัน)
10. **อักขระที่สับสน** — ตัด 0/O/1/I ออกจากชุดรหัส และ normalize เป็นตัวใหญ่ก่อนเทียบ (ผู้ใช้พิมพ์ตัวเล็กได้)
11. **ข้อความยาว/ฟิลด์เกินขีด** ทำให้ LINE ปฏิเสธทั้งก้อน — ตัดทุกช่องในตัวสร้างการ์ด ไม่ใช่ที่ผู้เรียก
12. **อย่าให้การส่ง LINE ขวางงานหลัก** — ล้มแล้วบันทึกและไปต่อ; ห้ามรอผล LINE ในคำขอของผู้ใช้เมื่อทำได้ (ระบบนี้ส่งใน `notifyUser` ที่กลืน error; โครงการที่มีปริมาณมากควรใช้คิว — ดู LINE-NOTIFICATIONS-KNOWLEDGE §3)
13. **โควตา LINE** (ขึ้นกับแผน OA) — ตั้งเพดานของเราให้ต่ำกว่า และแจ้งเตือนอื่นยังไปทางช่องทางอื่นเมื่อเต็ม
14. **อย่าใส่ความลับในไฟล์/คอมมิต/เอกสาร** รวมทั้ง secret และ token; ถ้าเคยเผลอแปะในแชต ให้ออก token ใหม่ (reissue) ที่ LINE Console

## 13. ช่องว่างที่ระบบนี้ยังไม่ได้ทำ (แนะนำให้ทำในโครงการใหม่)

| เรื่อง | สถานะใน ThaiPass | คำแนะนำ |
| --- | --- | --- |
| **LINE userId หนึ่งตัวผูกได้กับผู้ใช้เว็บเดียว** | ไม่มี unique บน `address` — บัญชี LINE เดียวผูกกับผู้ใช้เว็บหลายคนได้ (เช่น ผู้ใช้สร้างหลายบัญชี) ทำให้ข้อความของทุกบัญชีไปที่ LINE เดียว | เพิ่ม `create unique index … on notification_channels (address) where channel='line' and status='active'` และตอบข้อความที่เหมาะสมเมื่อชน |
| **นับครั้งเดารหัสต่อแถว (`attempts`)** | ใช้กับ WhatsApp เท่านั้น; LINE ค้นด้วย hash จึงนับต่อแถวไม่ได้ — ป้องกันด้วย rate-limit ต่อ LINE userId (10/10 นาที) + รหัส 40 บิต + หมดอายุ 30 นาที | พอสำหรับโครงการส่วนใหญ่; ถ้าต้องเข้มกว่า ให้ใช้ rate-limit ทั่วทั้งระบบต่อ IP/ต่อวินาที และเฝ้าดู `bindLine` ล้มเหลวจำนวนมาก |
| **ผู้ใช้กลับมา follow เอง (refollow event)** | ไม่ได้รับ event `follow` | เพิ่มการรับ `follow` เพื่อเปลี่ยน `stopped`(unfollowed) → `active` ได้เองถ้าแถวยังมี `address` เดิม |
| **ภาษาของข้อความช่วยเหลือ/รหัสผิด** | ต่อกันทุกภาษา (ไม่รู้ตัวผู้ส่ง) | ใช้ `event.source` + `GET /v2/bot/profile/{userId}` ภาษาจาก LINE หรือ `follow`/`message` locale (ถ้ามี) เพื่อเลือกภาษาเดียว |
| **คิว + retry + ส่วนสำรอง** | ส่งตรงในคำขอ (`notifyUser`) — ไม่มีคิว/retry-key | ปริมาณสูง → ดูแบบคิวใน LINE-NOTIFICATIONS-KNOWLEDGE (เขียนคิว, tick ส่ง, `X-Line-Retry-Key`, หยุดทั้งระบบเมื่อ 401/403) |
| **ค่ากำหนดผู้ใช้ (opt-in รายประเภท)** | เปิดทุกประเภทเมื่อผูกแล้ว | เพิ่มสวิตช์ transactional/reminder ต่อผู้ใช้ (เหมือน RooSuk) |
| **ตรวจ webhook ซ้ำ (idempotency)** | ใช้ compare-and-set ที่ `status='pending'` พอสำหรับการผูก | ถ้าเพิ่มการกระทำอื่นจาก webhook ให้เก็บ `webhookEventId` กันซ้ำ |

## 14. เช็กลิสต์นำไปใช้ซ้ำ

**LINE**
- [ ] สร้าง OA, เปิด Messaging API, จด Basic ID
- [ ] เก็บ Channel secret / access token ใน Vercel (ไม่ใส่ไฟล์), ตั้งตัวแปร 3–4 ตัวตาม §4.2
- [ ] ตั้ง Webhook URL + Use webhook + Verify ผ่าน · ปิด Auto-reply/Greeting
- [ ] ตกลงเรื่อง **Provider** ให้ชัดก่อนเริ่ม (ย้ายทีหลังต้องผูกใหม่หมด)

**ฐานข้อมูล**
- [ ] ตาราง `notification_channels` + `message_log` (RLS เปิด, ไม่มี policy ฝั่งผู้ใช้) + index
- [ ] (แนะนำ) unique index ของ LINE userId ที่ `active`
- [ ] ฟังก์ชัน HMAC สำหรับ hash รหัส (คีย์ลับฝั่งเซิร์ฟเวอร์)

**โค้ด**
- [ ] `verifyLineSignature` (HMAC-SHA256 base64, `timingSafeEqual`) + เทสต์
- [ ] `startLineLink` / `bindLine` (compare-and-set) / `lineUnfollowed` / `disconnectChannel`
- [ ] `POST /api/line/webhook`: raw body → ตรวจลายเซ็น → จำกัดขนาด/จำนวน event → rate-limit ต่อ userId → regex รหัส → ตอบภาษาผู้ใช้
- [ ] `sendToChannels` ภายใต้ตัวส่งกลางเดียว · fallback ข้อความธรรมดาเมื่อการ์ดโดน 400 · error ถาวร → `stopped`
- [ ] ตัวสร้างการ์ดบริสุทธิ์ + ตัดความยาวทุกช่อง + เทสต์ขีดจำกัด
- [ ] UI 4 ขั้นตอน + poll รีเฟรช + ปุ่ม copy/เพิ่มเพื่อน/ส่งรหัส + ปุ่มยกเลิก + ปุ่มทดสอบ (ทุกปุ่มมีสปินเนอร์, ข้อความผ่านพจนานุกรม)
- [ ] หน้าแอดมิน: สวิตช์ + โควตา + Webhook URL (ป้องกันด้วย `requireAdmin*`)

**ทดสอบ**
- [ ] ตัวจำลอง LINE (push/reply + กรณี 401/403/400) → ทดสอบ live ของการผูก → ค่อยใช้ OA จริง
- [ ] รายการอุปกรณ์จริงใน §11

### โครงโค้ดขั้นต่ำ (ย่อจากของจริง)

```ts
// line.ts — ตรวจลายเซ็นจากข้อความดิบ
import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyLineSignature(raw: string, sig: string | null, secret: string) {
  if (!sig || !secret) return false;
  const exp = createHmac("sha256", secret).update(raw).digest("base64");
  return sig.length === exp.length && timingSafeEqual(Buffer.from(sig), Buffer.from(exp));
}

// service.ts — ออกรหัส และผูก (compare-and-set)
const SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";                       // ไม่มี 0/O/1/I
const makeCode = () => Array.from({ length: 8 }, () => SAFE[randomInt(SAFE.length)]).join("");
export async function startLineLink(userId: string) {
  const code = makeCode();
  const up = await db().from("notification_channels").upsert(
    { owner_id: userId, channel: "line", address: null, status: "pending", code_hash: hashCode(code),
      code_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), attempts: 0, last_error: null, verified_at: null },
    { onConflict: "owner_id,channel" }).select("id");
  if (up.error || up.data?.length !== 1) return { ok: false as const, error: "err_generic" };
  return { ok: true as const, code, basicId: process.env.LINE_BASIC_ID! };
}
export async function bindLine(codeRaw: string, lineUserId: string) {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code) || !lineUserId) return { ok: false as const };
  const { data: row } = await db().from("notification_channels").select("id, owner_id, attempts, code_expires_at")
    .eq("channel", "line").eq("status", "pending").eq("code_hash", hashCode(code)).maybeSingle();
  if (!row?.code_expires_at || Date.parse(row.code_expires_at) < Date.now() || row.attempts >= 5) return { ok: false as const };
  const upd = await db().from("notification_channels")
    .update({ address: lineUserId, status: "active", code_hash: null, code_expires_at: null, verified_at: new Date().toISOString() })
    .eq("id", row.id).eq("status", "pending").select("id");               // ใช้ได้ครั้งเดียว
  return upd.data?.length === 1 ? { ok: true as const, ownerId: row.owner_id } : { ok: false as const };
}

// app/api/line/webhook/route.ts
export async function POST(req: NextRequest) {
  const raw = await req.text();                                           // ไบต์ดิบ
  if (raw.length > 200_000 || !verifyLineSignature(raw, req.headers.get("x-line-signature"), process.env.LINE_CHANNEL_SECRET ?? ""))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  for (const e of (JSON.parse(raw).events ?? []).slice(0, 20)) {
    const uid = e.source?.userId; if (!uid) continue;
    if (e.type === "unfollow") { await lineUnfollowed(uid); continue; }
    if (e.type !== "message" || e.message?.type !== "text" || !e.replyToken) continue;
    if (!(await rateLimit(`line:bind:${uid}`, 10, 600))) continue;
    const code = (e.message.text ?? "").trim().toUpperCase().match(/^(?:LINK\s+)?([A-Z2-9]{8})$/)?.[1];
    if (!code) { await lineReply(e.replyToken, HELP_ALL_LANGS); continue; }
    const r = await bindLine(code, uid);
    await lineReply(e.replyToken, r.ok ? linkedTextIn(await langOf(r.ownerId)) : BAD_CODE_ALL_LANGS);
  }
  return NextResponse.json({ ok: true });
}
```

> ลิงก์ที่ใช้ใน UI: add friend `https://line.me/R/ti/p/<Basic ID ที่ encodeURIComponent>` · ส่งข้อความพร้อมรหัส `https://line.me/R/oaMessage/<Basic ID ที่ encodeURIComponent>/?<รหัส>`
