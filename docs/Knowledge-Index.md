## Knowledge ที่ถอดจาก RooSuk (Next.js 16 + Supabase) 

ไฟล์ชุดนี้เขียนจากโค้ดจริงของ RooSuk

ไฟล์ในโฟลเดอร์นี้ไม่ใช่คู่มือผู้ใช้ และไม่ใช่เอกสารขายของ
มันคือ **บันทึกว่าเรื่องแต่ละเรื่องถูกทำอย่างไรในโครงการนี้ ทำไมจึงทำแบบนั้น
และสิ่งที่พังมาแล้วจริง ๆ** เพื่อให้โครงการถัดไปลอกโครงไปใช้ได้โดยไม่ต้องเจ็บซ้ำ

แต่ละไฟล์เขียนด้วยโครงเดียวกัน:

| หัวข้อในไฟล์      | ตอบคำถามว่า                                   |
| ----------------- | --------------------------------------------- |
| ปัญหาที่แก้       | ทำไมต้องมีของชิ้นนี้                          |
| โครงที่ใช้        | ตาราง / ไฟล์ / ลำดับการทำงาน                  |
| กฎที่ห้ามละเมิด   | สิ่งที่ถ้าทำผิดแล้วระบบพังเงียบ ๆ             |
| บทเรียนจากของจริง | บั๊กที่เกิดขึ้นแล้วบน production และสาเหตุราก |
| ลอกไปใช้อย่างไร   | ขั้นตอนย่อสำหรับโครงการใหม่                   |

## สารบัญ

| เรื่อง                                                   | ไฟล์                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| ตั้งค่า AI (provider, โมเดลต่องาน, fallback, `/admin/ai`) | [AI-PROVIDER-MODEL-KNOWLEDGE.md](./AI-PROVIDER-MODEL-KNOWLEDGE.md)         |
| คำสั่งและกฎของ AI (`/admin/prompts`, ตัวคัดกรอง)          | [AI-PROMPTS-RULES-KNOWLEDGE.md](./AI-PROMPTS-RULES-KNOWLEDGE.md)           |
| สถิติการใช้งาน                                           | [USAGE-ANALYTICS-KNOWLEDGE.md](./USAGE-ANALYTICS-KNOWLEDGE.md)             |
| ชื่อ โลโก้ ไอคอน และการติดตั้งเป็นแอป                   | [BRANDING-KNOWLEDGE.md](./BRANDING-KNOWLEDGE.md)                           |
| สวิตช์ฟีเจอร์                                            | [FEATURE-FLAGS-KNOWLEDGE.md](./FEATURE-FLAGS-KNOWLEDGE.md)                 |
| Audit trail                                              | [AUDIT-TRAIL-KNOWLEDGE.md](./AUDIT-TRAIL-KNOWLEDGE.md)                     |
| ผู้ดูแลระบบ (Admin)                                      | [ADMINS-KNOWLEDGE.md](./ADMINS-KNOWLEDGE.md)                               |
| Responsive Web Design                                    | [RESPONSIVE-WEB-KNOWLEDGE.md](./RESPONSIVE-WEB-KNOWLEDGE.md)               |
| การทำงานเมื่อกดปุ่ม Back                                 | [BACK-BUTTON-KNOWLEDGE.md](./BACK-BUTTON-KNOWLEDGE.md)                     |
| การเปลี่ยนรหัสผ่าน                                       | [CHANGE-PASSWORD-KNOWLEDGE.md](./CHANGE-PASSWORD-KNOWLEDGE.md)             |
| เมนู Desktop (sidebar) + มือถือ (bottom bar + sheet)     | [NAVIGATION-KNOWLEDGE.md](./NAVIGATION-KNOWLEDGE.md)                       |
| กฎอัตโนมัติ (rules engine ที่แอดมินปรับได้)              | [AUTOMATION-RULES-KNOWLEDGE.md](./AUTOMATION-RULES-KNOWLEDGE.md)           |
| อัปเดตสถานะให้ผู้ใช้เห็นทันทีไม่ต้อง refresh (Live sync) | [LIVE-SYNC-KNOWLEDGE.md](./LIVE-SYNC-KNOWLEDGE.md)                           |
| ฟอนต์ สี และขนาดตัวอักษรในแต่ละส่วนของระบบ (typography + color) | TYPOGRAPHY-COLOR-KNOWLEDGE.md                                   |
| แจ้งเตือนในแอปและ LINE: คิว โควตา retry การ์ด Flex       | [LINE-NOTIFICATIONS-KNOWLEDGE.md](./LINE-NOTIFICATIONS-KNOWLEDGE.md)       |
| สองภาษาและการสลับภาษา                                    | [I18N-KNOWLEDGE.md](./I18N-KNOWLEDGE.md)                                   |


## บริบทของ stack ที่โค้ดตัวอย่างอ้างถึง

ทุกไฟล์ยกตัวอย่างจากโค้ดจริงของโครงการนี้ ซึ่งใช้:

- **TanStack Start** (React 19 + Vite) — `createServerFn` คือ RPC ฝั่ง server
  มี middleware `requireSupabaseAuth` / `requireAdmin`
- **Supabase** — Postgres + RLS + Storage; มี 2 client คือ client ของผู้ใช้
  (ติด RLS) และ `supabaseAdmin` (service-role ข้าม RLS)
- **Netlify** — static + Functions; มี scheduled function หนึ่งตัวเป็น "tick"
- **Tailwind CSS v4** (`@theme inline` ใน `src/styles.css`) + shadcn/ui

ถ้าโครงการใหม่ใช้ stack อื่น **แนวคิดในแต่ละไฟล์ยังใช้ได้ทั้งหมด** — สิ่งที่ต้อง
แปลคือชื่อ API เท่านั้น จุดที่ผูกกับ stack จะมีหมายเหตุกำกับไว้

## กฎข้ามทุกเรื่อง (ถ้าอ่านได้แค่หน้าเดียว ให้อ่านหน้านี้)

1. **UPDATE ที่ไม่ตรงแถวไหนเลย คือ "สำเร็จ" ในสายตา PostgREST**
   ทุกการเขียนที่สำคัญต้อง `.select("id")` แล้วนับแถวที่ได้กลับมา ไม่ใช่เชื่อ `error == null`
   — บั๊กเงียบ 2 ตัวในโครงการนี้มาจากข้อนี้ข้อเดียว
2. **ซ่อนปุ่มไม่ใช่การปิดฟีเจอร์** server function ยังถูกเรียกได้อยู่ ต้องเช็กที่ server ด้วยทุกครั้ง
3. **ค่าที่ admin ตั้งได้ ต้องไม่ hard-code ซ้ำในหน้าเว็บ** ถ้าซ้ำ วันหนึ่งสองที่จะไม่ตรงกัน
   และผู้ใช้จะเห็นตัวเลขที่ไม่มีใครตั้ง
4. **ของที่ยังไม่ผ่านการตรวจ ห้ามบันทึกว่าผ่านแล้ว** (เงิน เอกสาร การยืนยันตัวตน)
   สถานะ "รอตรวจ" ต้องมีอยู่จริงในฐานข้อมูล
5. **การแจ้งเตือนที่ออกนอกแอป ต้องตอบ ใคร/อะไร/เมื่อไหร่ ได้ในตัวมันเอง**
   คนอ่านการ์ด LINE อาจไม่เปิดแอปทั้งวัน
6. **ค่า default ของ fallback ต้องเป็น "ทำงานต่อ" ไม่ใช่ "หยุด"**
   ตารางตั้งค่าอ่านไม่ได้ → ใช้ค่าในโค้ด; flag อ่านไม่ได้ → ถือว่าเปิด; กฎอ่านไม่ได้ → รันด้วยค่าเดิม
7. **migration กับ deploy ไม่พร้อมกัน** โค้ดต้องทนช่วงที่คอลัมน์ยังไม่มี
   (ดักด้วย error code `42703` / `PGRST204` / `23514` แล้วเขียนแบบลดรูป)
8. **ใช้ภาษาที่อ่านแล้วรู้เรื่องในทุกข้อความที่ผู้ใช้เห็น** error code ที่ server โยนมา
   ต้องแปลเป็นประโยคในภาษาของผู้ใช้ ไม่ใช่โชว์ stack
