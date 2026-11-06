# Knowledge: "กฎอัตโนมัติ" — rules engine ที่แอดมินปรับได้โดยไม่ต้อง deploy (จากระบบ RooSuk)

> อ้างอิงโค้ดจริง: `supabase/migrations/20261013000100_notifications.sql` (`automation_rules`, `cron_ticks`) และ migration ที่เพิ่มกฎภายหลัง
> (`20261023000100_more_automation_rules.sql`, `20261031000100_health_agent.sql`, `20261106000100_diet_watch_rule.sql`, `20261202000100_goal_menus.sql`,
> `20261203000100_goal_finish.sql`, `20261216000100_stock_alerts.sql`, `20261224000100_deposit_loan.sql`)
> · `src/lib/notify/rules.ts` (เงื่อนไข pure) · `src/lib/notify/server.ts` (`runTick` และแต่ละกฎ) · `src/lib/notify/tick-view.ts`
> · `src/app/api/cron/notify/route.ts` · `netlify/functions/notify-tick.mts` · `src/app/actions/notifications.ts` (`saveRuleAction`) · `src/app/(app)/admin/rules/page.tsx`
> แนวคิดตั้งต้น: `docs/06-automation-rules.md` (โครงการก่อนหน้า)

---

## 1. ปัญหาที่แก้

ระบบต้องทำงานตามเวลาเอง (เตือนเช็กอินตอนเย็น, เตือนแพ็กเกจใกล้หมด, แจ้งสต็อกใกล้หมดอายุ, ปิดสายปรึกษาที่ไม่มีใครรับ, ลบข้อมูลเก่า ฯลฯ)
และเจ้าของต้อง **เปิด/ปิดหรือปรับตัวเลข** ของงานเหล่านี้ได้เอง (ชั่วโมงที่เตือน, กี่วันก่อนหมดอายุ) โดยไม่ต้อง deploy
— แต่ **ไม่ให้แอดมินเขียนเงื่อนไขเอง** (ตัวเลือกแบบนั้นพังเงียบและทดสอบไม่ได้)

## 2. สรุปสั้น

1. **ตารางบอกแค่ "รันไหม" และ "ใช้ตัวเลขอะไร"; เงื่อนไขอยู่ในโค้ดที่มีชนิดและมีเทส** (`rules.ts`)
2. **กฎที่ไม่มีแถวในตาราง = เปิด** และใช้ตัวเลขค่าเริ่มต้นในโค้ด — อ่านตารางไม่ได้ก็ยังทำงาน (เตือนที่เงียบไปเพราะแถวหาย แย่กว่าเตือนที่ไม่สนตัวเลขที่ปรับไว้ชั่วคราว)
3. seed ด้วย `ON CONFLICT DO NOTHING` — deploy ใหม่ **ไม่ทับ** ค่าที่แอดมินปรับ
4. **tick เดียวทุก 10 นาที**: Netlify scheduled function → `POST /api/cron/notify` (Bearer `CRON_SECRET`, เทียบแบบ constant-time) → `runTick()`
5. `runTick` รันกฎตามลำดับ, **แต่ละกฎล้มได้โดยไม่ลากกฎอื่น**, มีงบเวลา 20 วินาที (เกินแล้วหยุดและบันทึกว่าหยุดที่กฎไหน), จากนั้นส่งคิว LINE
6. ทุกกฎต้อง **idempotent**: รันซ้ำทุก 10 นาทีแต่บอกคนละครั้ง ด้วย `dedupe_key` (unique ต่อคน)
7. บันทึกทุกรอบใน `cron_ticks` (สรุปต่อกฎ) และ `last_run_at`/`last_count` ต่อกฎ — หน้าแอดมินแสดงเป็นภาษาคน ไม่ใช่ JSON
8. แอดมินแก้ได้เฉพาะ **ชื่อพารามิเตอร์ที่กฎมีอยู่แล้ว** และค่าเป็นตัวเลข 0–10,000; ทุกการแก้ audit

## 3. โครงที่ใช้

### 3.1 ตาราง

```sql
create table public.automation_rules (
  key text primary key,                       -- ตรงกับชื่อในโค้ด
  title text not null, description text not null default '',
  enabled boolean not null default true,
  params jsonb not null default '{}' check (jsonb_typeof(params) = 'object'),   -- {"hour": 19, "min_streak": 3}
  sort_order integer not null default 100,
  last_run_at timestamptz, last_count integer,
  updated_by uuid, updated_at timestamptz not null default now()
);
insert into public.automation_rules (key, title, description, enabled, params, sort_order) values
  ('checkin_reminder', 'เตือนเช็กอินรายวัน', '…หลังเวลาที่ตั้งไว้ (ชั่วโมงเวลาไทย)', true, '{"hour": 19, "min_streak": 3}', 10),
  ('trial_ending', …, '{"days_first": 3, "days_second": 1}', 20),
  ('queue_expire', …, '{"hours": 24}', 90),
  ('cleanup_old', …, '{"days": 90}', 95)
on conflict do nothing;                         -- ค่าเริ่มต้นเท่านั้น ไม่ทับที่แอดมินแก้
create table public.cron_ticks (id bigint identity, started_at, finished_at, summary jsonb);
-- ทั้งสองตาราง: RLS เปิด, revoke ทั้งหมด → service role เท่านั้น
```

### 3.2 อ่านกฎ (pure)

```ts
export function parseRules(rows): RuleSet { … }                         // params ที่ไม่ใช่ object = {}
export function ruleEnabled(rules, key) { return rules.get(key)?.enabled ?? true; }   // ไม่มีแถว = เปิด
export function ruleNumber(rules, key, param, fallback, max = 10_000) {
  const raw = rules.get(key)?.params[param]; const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;       // ค่าผิด = ค่าเริ่มต้นในโค้ด
}
```

เงื่อนไขเป็นฟังก์ชัน pure ที่รับ "ตอนนี้" เข้ามา (ไม่เรียก `new Date()` เอง) → เทสได้ทุกกรณี เช่น

```ts
checkinReminderKind({ bangkokHour, hour, checkedToday, streak, minStreak }); // null | "plain" | "streak"
expiryStage(daysLeft, first, second); // วันเตือนครั้งที่ 1 / 2
reportMonthToAnnounce(today, day); // ประกาศรายงานเดือนก่อน ตั้งแต่วันที่ day ถึง day+3 (รอบที่พลาดยังตามทัน)
checkupReminder({
  today,
  latestLabDate,
  hadOutOfRange,
  annualMonths,
  recheckDays,
});
bangkokHour(now); // ชั่วโมงเวลาไทย — server อยู่ UTC
```

### 3.3 `runTick` (หัวใจ)

```ts
const steps: [string, () => Promise<number>][] = [
  ["checkin_reminder", …], ["streak_at_risk", …], ["monthly_report_ready", …], ["checkup_reminder", …],
  ["agent_reminders", …], ["diet_watch", …], ["goal_finished", …], ["stock_alerts", …], ["deposit_care", …],
  ["consult_sweep", …], ["consult_reminders", …], ["trial_ending", …], ["plan_expiring", …],
  ["queue_expire", …], ["cleanup_old", …],                          // งานเก็บกวาดไว้ท้าย
];
for (const [key, step] of steps) {
  if (ctx.overBudget()) { stoppedEarlyAt = key; break; }           // 20 วินาที: function มีเวลาจำกัด
  if (!ruleEnabled(rules, key)) { summary[key] = -1; continue; }   // -1 = ปิดอยู่
  try { summary[key] = await step(); }                             // จำนวนที่ทำ (คนที่ได้แจ้ง ฯลฯ)
  catch (err) { console.error(…); summary[key] = 0; continue; }    // กฎหนึ่งล้ม กฎอื่นยังรัน
  await db.from("automation_rules").update({ last_run_at, last_count: summary[key] }).eq("key", key);
}
const line = await deliverQueued(lineDeps(now), DELIVER_BATCH);    // ส่งคิว LINE ท้ายรอบ
// cron_ticks.summary = { rules, line, stoppedEarlyAt? }
```

- `ctx` มี `now`, `today` (วันไทย), `rules`, `overBudget()` — กฎทุกตัวรับ ctx เดียวกัน
- โหมดเทส: `runTick(now, { rules, users })` รันเฉพาะกฎและคนที่ระบุ และ **ไม่ส่ง LINE** (live test ไม่ไปถึงมือถือจริง)
- กฎของฟีเจอร์ที่ถูกปิดด้วยสวิตช์ฟีเจอร์ คืน 0 ทันที (`featureEnabled`)
- งานหนักที่ใช้ AI (ไอเดียเมนูรายสัปดาห์) มี scheduled function แยก (`goal-menus.mts` ทุก 5 นาที, ทำทีละชุด, retry) แต่ยังเปิด/ปิดผ่าน `automation_rules` เหมือนกัน

### 3.4 กฎหนึ่งตัวทำอะไร (แบบแผน)

1. หาผู้รับ (เช่น คนที่เปิดรับการเตือน **และ** ผูก LINE แล้ว — กลุ่มเดียวกันทุกกฎเตือน)
2. ใช้ฟังก์ชันเงื่อนไข pure กับข้อมูลของแต่ละคน
3. สร้าง notice (ในภาษาของผู้รับ) พร้อม `dedupeKey` เช่น `checkin:<วันที่>`, `trial:<วันหมด>:first`, `goal-finished:<id>`
4. `notifyUser()` เขียนกล่องแจ้งเตือนในแอป + คิว LINE — ซ้ำ key = ข้าม (unique index) → รันทุก 10 นาทีก็บอกครั้งเดียว
5. คืนจำนวนที่ทำ

### 3.5 หน้าแอดมิน `/admin/rules`

- ต่อกฎ: ชื่อ คำอธิบาย สวิตช์ ช่องตัวเลขตาม `params` ที่มีอยู่ (`param.<name>`) และ "รอบล่าสุด: เมื่อไร ทำไปกี่รายการ"
- `saveRuleAction`: `requireAdmin` → อ่านกฎ → รับเฉพาะ key ที่ params มีอยู่แล้ว → ตัวเลข 0–10,000 ปัดเป็นจำนวนเต็ม → UPDATE **นับแถว** → audit `settings.rule_save`
- ประวัติรอบล่าสุด (`cron_ticks`) แสดงผ่าน `describeTick()` เป็นบรรทัดภาษาคน: กฎไหนทำกี่รายการ / ปิดอยู่ / หยุดเพราะเกินเวลา / LINE ส่งได้ ข้าม ถูกบล็อก ล้มเหลว — อ่าน summary แบบป้องกันตัว (ข้อมูลเก่าอาจไม่มีบางช่อง)
- ส่วนการตั้งค่า LINE (โควตารายเดือน, ส่วนสำรอง, "ส่งต่อ" หลังถูกหยุด) อยู่หน้าเดียวกัน — ดู `docs/LINE-NOTIFICATIONS-KNOWLEDGE.md`

### 3.6 ความปลอดภัยของปลายทาง cron

```ts
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? ""),
    b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
// ไม่มี secret ในเครื่อง = 503 (ปิด), secret ผิด = 401 — ห้ามเป็นปุ่มสาธารณะที่ส่งข้อความได้
```

## 4. กฎที่ห้ามละเมิด

1. เงื่อนไขอยู่ในโค้ด; ตารางมีแค่สวิตช์และตัวเลข
2. กฎใหม่ต้องทำงานได้แม้ไม่มีแถวในตาราง (ค่าเริ่มต้นในโค้ด) และ seed ด้วย `ON CONFLICT DO NOTHING`
3. ทุกกฎ idempotent ด้วย dedupe key — รันซ้ำ/รันพลาดแล้วตามทัน ต้องไม่ส่งซ้ำ
4. ทุกการคำนวณเวลาใช้เวลาไทย (`bangkokHour`, `bangkokDate`) ไม่ใช่เวลาของ server
5. ห้ามส่ง LINE ภายในคำขอของผู้ใช้แบบรอผล — เขียนคิว แล้ว tick หรือการ flush หลังตอบส่งให้
6. กฎหนึ่งล้มต้องไม่หยุดกฎอื่น; งานทั้งหมดต้องจบในงบเวลาของ function
7. ปลายทาง cron ต้องมี secret และเทียบแบบ constant-time
8. เทสที่รัน tick ต้องจำกัดคนและไม่ส่ง LINE (และลบแจ้งเตือนที่ไปถึงแอดมินจริงหลังเทส)

## 5. บทเรียนจากของจริง

| เกิดอะไร                                                             | สาเหตุราก                             | แก้อย่างไร                                                                       |
| -------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| แอดมินอ่านหน้า "รอบล่าสุด" ไม่ออก                                    | แสดง JSON ดิบของ `cron_ticks.summary` | `describeTick()` แปลงเป็นบรรทัดภาษาคน                                            |
| กฎแจ้งเตือนสต็อกไปโผล่กลางกลุ่มกฎเตือนผู้ใช้ในหน้าแอดมิน อ่านสับสน   | seed `sort_order` ผิดกลุ่ม            | migration แยกแก้ `sort_order` (แก้เฉพาะเมื่อยังเป็นค่าเดิม — ไม่ทับที่แอดมินจัด) |
| deploy แล้วตัวเลขที่แอดมินปรับกลับเป็นค่าเริ่มต้น                    | seed แบบ upsert                       | `ON CONFLICT DO NOTHING`                                                         |
| ข้อความเตือนเลยเวลาไปแล้วยังถูกส่ง (เช่นเตือนเช็กอินตอนเช้าวันถัดไป) | คิวค้างเพราะ LINE ล่ม/ถูกหยุด         | กฎ `queue_expire` ข้ามข้อความที่ค้างเกินจำนวนชั่วโมง                             |
| tick ใช้เวลานานจนถูกตัด งานท้ายไม่เคยได้รัน                          | ไม่มีงบเวลา                           | งบ 20 วินาที + บันทึก `stoppedEarlyAt` + งานเก็บกวาดไว้ท้าย                      |
| live test เกือบส่ง LINE ถึงมือถือแอดมินจริง                          | tick ทั้งรอบรันในเทส                  | โหมด `only` (กฎ+คนที่ระบุ, ไม่ส่ง LINE) + ลบแจ้งเตือนของแอดมินหลังเทส            |

## 6. ลอกไปใช้อย่างไร

1. ตาราง `automation_rules` + `cron_ticks` (service role) + seed ค่าเริ่มต้น
2. `rules.ts`: `parseRules`, `ruleEnabled`, `ruleNumber` + เงื่อนไข pure ที่รับเวลาเข้ามา
3. `runTick(now, only?)`: โหลดกฎ (พังได้ → ค่าเริ่มต้น), loop ตามลำดับ, try/catch ต่อกฎ, งบเวลา, บันทึก
4. route `/api/cron/...` ที่มี secret + scheduled function เรียกทุก 10 นาที
5. ระบบแจ้งเตือนที่มี dedupe key (`docs/LINE-NOTIFICATIONS-KNOWLEDGE.md`)
6. หน้าแอดมิน: สวิตช์ + ตัวเลข + รอบล่าสุดแบบอ่านง่าย + audit
7. เทส: เงื่อนไขทุกตัว (ขอบเขตชั่วโมง/วัน, ข้ามเดือน), `ruleNumber` กับค่าผิด, `describeTick` กับข้อมูลเก่า, live: กฎหนึ่งตัวกับผู้ใช้ทดสอบแล้วได้แจ้งเตือนครั้งเดียวแม้รันสองรอบ
